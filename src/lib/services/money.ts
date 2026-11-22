import "server-only";
import type { PaymentKind, PaymentMode, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dueStatusFor, todayIST } from "@/lib/money";

type Tx = Prisma.TransactionClient;

/**
 * Atomically takes the next receipt number from Settings → e.g. "R101".
 * If it's already used (e.g. the prefix was changed back), jump past the highest existing number.
 */
export async function nextReceiptNo(tx: Tx): Promise<string> {
  const s = await tx.settings.update({
    where: { id: 1 },
    data: { nextReceiptNumber: { increment: 1 } },
    select: { receiptPrefix: true, nextReceiptNumber: true },
  });
  const no = `${s.receiptPrefix}${s.nextReceiptNumber - 1}`;
  if (!(await tx.payment.findUnique({ where: { receiptNo: no }, select: { id: true } }))) return no;

  const rows = await tx.payment.findMany({ where: { receiptNo: { startsWith: s.receiptPrefix } }, select: { receiptNo: true } });
  let max = 0;
  for (const r of rows) {
    const n = Number(r.receiptNo.slice(s.receiptPrefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  await tx.settings.update({ where: { id: 1 }, data: { nextReceiptNumber: max + 2 } });
  return `${s.receiptPrefix}${max + 1}`;
}

/** Re-derive a due's status from its non-voided payments. */
export async function refreshDue(tx: Tx, dueId: string) {
  const due = await tx.due.findUnique({ where: { id: dueId }, include: { payments: { select: { amount: true, voidedAt: true } } } });
  if (!due) return;
  const status = dueStatusFor(due, due.payments);
  if (status !== due.status) await tx.due.update({ where: { id: dueId }, data: { status } });
}

export interface NewPayment {
  profileId: string;
  kind: PaymentKind;
  amount: number;
  mode: PaymentMode;
  reference?: string | null;
  paidAt?: Date;
  dueId?: string | null;
  membershipId?: string | null;
  description: string;
  notes?: string | null;
  userId: string;
}

export async function recordPayment(tx: Tx, p: NewPayment) {
  const profile = await tx.profile.findUniqueOrThrow({ where: { id: p.profileId }, select: { code: true, fullName: true, contactName: true } });
  const payment = await tx.payment.create({
    data: {
      receiptNo: await nextReceiptNo(tx),
      profileId: p.profileId,
      payerName: profile.contactName ? `${profile.contactName} (for ${profile.fullName})` : profile.fullName,
      profileCode: profile.code,
      kind: p.kind,
      amount: p.amount,
      mode: p.mode,
      reference: p.reference || null,
      paidAt: p.paidAt ?? new Date(),
      dueId: p.dueId || null,
      membershipId: p.membershipId || null,
      description: p.description,
      notes: p.notes || null,
      createdById: p.userId,
    },
  });
  if (p.dueId) await refreshDue(tx, p.dueId);
  return payment;
}

/** Success fee for a profile: their latest membership's fee → that plan's fee → bureau default. */
export async function successFeeFor(tx: Tx, profileId: string): Promise<number> {
  const m = await tx.membership.findFirst({
    where: { profileId },
    orderBy: { startDate: "desc" },
    select: { successFee: true, plan: { select: { successFee: true } } },
  });
  if (m?.successFee != null) return m.successFee;
  if (m?.plan.successFee != null) return m.plan.successFee;
  const s = await tx.settings.findUniqueOrThrow({ where: { id: 1 }, select: { successFeeDefault: true } });
  return s.successFeeDefault;
}

/** When a proposal is matched: one success-fee due per family (skipped if 0 or already created). */
export async function createSuccessFeeDues(tx: Tx, proposalId: string) {
  const p = await tx.proposal.findUniqueOrThrow({
    where: { id: proposalId },
    select: { fromProfile: { select: { id: true, code: true } }, toProfile: { select: { id: true, code: true } } },
  });
  const created: string[] = [];
  for (const [me, other] of [[p.fromProfile, p.toProfile], [p.toProfile, p.fromProfile]]) {
    // Families usually get each other's biodata, so the couple can have a proposal in each direction.
    // Bill once per couple: look at both directions, and at dues whose proposal record was removed.
    const label = `Success fee (match with ${other.code})`;
    const exists = await tx.due.findFirst({
      where: {
        profileId: me.id,
        kind: "SUCCESS_FEE",
        status: { not: "WAIVED" },
        OR: [
          { proposal: { fromProfileId: me.id, toProfileId: other.id } },
          { proposal: { fromProfileId: other.id, toProfileId: me.id } },
          { proposalId: null, label },
        ],
      },
    });
    if (exists) continue;
    const amount = await successFeeFor(tx, me.id);
    if (amount <= 0) continue;
    await tx.due.create({ data: { profileId: me.id, kind: "SUCCESS_FEE", label, amount, proposalId } });
    created.push(me.code);
  }
  return created;
}

/** Money summary for a profile page. */
export async function loadProfileMoney(profileId: string) {
  const [memberships, dues, payments, plans, settings] = await Promise.all([
    prisma.membership.findMany({ where: { profileId }, orderBy: { startDate: "desc" }, include: { plan: { select: { name: true, introLimit: true } } } }),
    prisma.due.findMany({ where: { profileId }, orderBy: { createdAt: "desc" }, include: { payments: { select: { amount: true, voidedAt: true } } } }),
    prisma.payment.findMany({ where: { profileId }, orderBy: { paidAt: "desc" }, include: { voidedBy: { select: { name: true } } } }),
    prisma.plan.findMany({ where: { active: true }, orderBy: { price: "asc" } }),
    prisma.settings.findUniqueOrThrow({ where: { id: 1 }, select: { registrationFee: true } }),
  ]);
  // "Current" = the membership running today (an early renewal starts in the future); else the latest one
  const today = todayIST();
  const current = memberships.find((m) => m.startDate <= today && m.endDate >= today) ?? memberships[0];
  // Introductions used = biodata shared with this family during it (date-only bounds are IST days)
  const IST = 330 * 60000;
  const introsUsed = current
    ? await prisma.proposal.count({
        where: {
          fromProfileId: profileId,
          createdAt: { gte: new Date(current.startDate.getTime() - IST), lt: new Date(current.endDate.getTime() + 86400000 - IST) },
        },
      })
    : 0;
  return { memberships, current, dues, payments, plans, registrationFee: settings.registrationFee, introsUsed };
}
