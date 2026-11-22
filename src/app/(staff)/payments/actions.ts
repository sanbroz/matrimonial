"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth/server";
import { parseDateLoose } from "@/lib/parse";
import { dueBalance, membershipEnd, rupees, todayIST } from "@/lib/money";
import { recordPayment, refreshDue } from "@/lib/services/money";

const MODE = z.enum(["CASH", "UPI", "BANK", "CHEQUE", "OTHER"]);
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const money = (fd: FormData, k: string) => {
  const s = str(fd, k).replace(/[,₹\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN;
};

function back(profileId: string, msg: string, key: "ok" | "error" = "ok"): never {
  redirect(`/profiles/${profileId}?${key}=${encodeURIComponent(msg)}#money`);
}

function refresh(profileId: string) {
  revalidatePath(`/profiles/${profileId}`);
  revalidatePath("/payments");
  revalidatePath("/");
}

/** Payment date from a date input: today → now, other day → noon IST that day. */
function paidAtFrom(fd: FormData): Date {
  const d = parseDateLoose(str(fd, "paidAt") || null);
  if (!d || d.getTime() === todayIST().getTime()) return new Date();
  return new Date(d.getTime() + (12 * 60 - 330) * 60000);
}

// ───────────── Membership ─────────────

export async function startMembership(fd: FormData) {
  const user = await requireUser();
  const profileId = z.string().parse(fd.get("profileId"));
  const plan = await prisma.plan.findUnique({ where: { id: str(fd, "planId") } });
  if (!plan) back(profileId, "Choose a plan", "error");
  const price = money(fd, "price") ?? plan.price;
  const successFee = money(fd, "successFee");
  const payNow = money(fd, "payNow") ?? 0;
  if (Number.isNaN(price) || Number.isNaN(payNow) || Number.isNaN(successFee)) back(profileId, "Amounts must be numbers", "error");
  if (payNow > price) back(profileId, "Payment is more than the plan price", "error");
  let start: Date;
  try {
    start = parseDateLoose(str(fd, "startDate")) ?? todayIST();
  } catch {
    back(profileId, "Invalid start date", "error");
  }
  const mode = MODE.catch("CASH").parse(fd.get("mode"));

  let receipt: string | null = null;
  await prisma.$transaction(async (tx) => {
    const m = await tx.membership.create({
      data: {
        profileId,
        planId: plan.id,
        startDate: start,
        endDate: membershipEnd(start, plan.durationDays),
        price,
        successFee: successFee ?? null,
        notes: str(fd, "notes") || null,
      },
    });
    const label = `${plan.name} membership`;
    const due = price > 0 ? await tx.due.create({ data: { profileId, kind: "MEMBERSHIP", label, amount: price, membershipId: m.id } }) : null;
    if (due && payNow > 0) {
      const p = await recordPayment(tx, {
        profileId, kind: "MEMBERSHIP", amount: payNow, mode, reference: str(fd, "reference"), dueId: due.id,
        membershipId: m.id, description: label, userId: user.id,
      });
      receipt = p.receiptNo;
    }
  });
  refresh(profileId);
  back(profileId, `Membership started: ${plan.name}${receipt ? `. Receipt ${receipt} created.` : ". Payment is pending (see dues)."}`);
}

// ───────────── Charges ─────────────

export async function addCharge(fd: FormData) {
  await requireUser();
  const profileId = z.string().parse(fd.get("profileId"));
  const kind = z.enum(["REGISTRATION", "OTHER"]).parse(fd.get("kind"));
  const amount = money(fd, "amount");
  if (!amount || Number.isNaN(amount)) back(profileId, "Enter an amount", "error");
  const label = kind === "REGISTRATION" ? "Registration fee" : str(fd, "label") || "Other charge";
  await prisma.due.create({ data: { profileId, kind, label, amount } });
  refresh(profileId);
  back(profileId, `${label} of ${rupees(amount)} added to dues`);
}

export async function payDue(fd: FormData) {
  const user = await requireUser();
  const dueId = z.string().parse(fd.get("dueId"));
  const due = await prisma.due.findUnique({ where: { id: dueId }, include: { payments: { select: { amount: true, voidedAt: true } } } });
  if (!due) redirect("/payments");
  const balance = dueBalance(due, due.payments);
  const amount = money(fd, "amount") ?? balance;
  if (!amount || Number.isNaN(amount)) back(due.profileId, "Enter the amount received", "error");
  if (amount > balance) back(due.profileId, `Only ${rupees(balance)} is due on "${due.label}"`, "error");

  const p = await prisma.$transaction((tx) =>
    recordPayment(tx, {
      profileId: due.profileId, kind: due.kind, amount, mode: MODE.catch("CASH").parse(fd.get("mode")),
      reference: str(fd, "reference"), paidAt: paidAtFrom(fd), dueId: due.id, membershipId: due.membershipId,
      description: due.label, notes: str(fd, "notes"), userId: user.id,
    }),
  );
  refresh(due.profileId);
  if (fd.get("returnTo") === "payments") redirect(`/payments?ok=${encodeURIComponent(`Receipt ${p.receiptNo}: ${rupees(amount)} received`)}`);
  back(due.profileId, `Receipt ${p.receiptNo}: ${rupees(amount)} received for ${due.label}`);
}

export async function editDueAmount(fd: FormData) {
  await requireUser();
  const dueId = z.string().parse(fd.get("dueId"));
  const due = await prisma.due.findUnique({ where: { id: dueId }, include: { payments: { select: { amount: true, voidedAt: true } } } });
  if (!due) redirect("/payments");
  const amount = money(fd, "amount");
  if (amount == null || Number.isNaN(amount)) back(due.profileId, "Enter an amount", "error");
  const paid = due.amount - dueBalance({ ...due, status: "OPEN" }, due.payments);
  if (amount < paid) back(due.profileId, `${rupees(paid)} has already been paid on this`, "error");
  await prisma.$transaction(async (tx) => {
    await tx.due.update({ where: { id: dueId }, data: { amount } });
    await refreshDue(tx, dueId);
  });
  refresh(due.profileId);
  back(due.profileId, `${due.label}: amount changed to ${rupees(amount)}`);
}

// ───────────── Owner only ─────────────

export async function waiveDue(fd: FormData) {
  await requireOwner();
  const dueId = z.string().parse(fd.get("dueId"));
  const due = await prisma.due.update({ where: { id: dueId }, data: { status: "WAIVED", notes: str(fd, "reason") || "Waived" } });
  refresh(due.profileId);
  back(due.profileId, `${due.label} waived`);
}

export async function voidPayment(fd: FormData) {
  const user = await requireOwner();
  const id = z.string().parse(fd.get("paymentId"));
  const reason = str(fd, "reason");
  const p = await prisma.payment.findUnique({ where: { id } });
  if (!p) redirect("/payments");
  const target = p.profileId ? `/profiles/${p.profileId}` : "/payments";
  if (!reason) redirect(`${target}?error=${encodeURIComponent("Give a reason to void a receipt")}#money`);
  if (!p.voidedAt) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason, voidedById: user.id } });
      if (p.dueId) await refreshDue(tx, p.dueId);
    });
  }
  if (p.profileId) refresh(p.profileId);
  revalidatePath(`/payments/${id}/receipt`);
  redirect(`/payments/${id}/receipt?ok=${encodeURIComponent("Receipt voided")}`);
}
