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

/** Payment date from a date input: today → now, other day → noon IST that day. null = invalid date. */
function paidAtFrom(fd: FormData): Date | null {
  let d: Date | null;
  try {
    d = parseDateLoose(str(fd, "paidAt") || null);
  } catch {
    return null;
  }
  if (!d || d.getTime() === todayIST().getTime()) return new Date();
  if (d.getTime() > todayIST().getTime()) return null; // no future-dated receipts
  return new Date(d.getTime() + (12 * 60 - 330) * 60000);
}

class BalanceError extends Error {}

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
  if (price === 0 && payNow > 0) back(profileId, "The price is ₹0, so there is nothing to receive", "error");
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
  const paidAt = paidAtFrom(fd);
  if (!paidAt) back(due.profileId, "Enter a valid payment date (not in the future)", "error");

  let p;
  try {
    p = await prisma.$transaction(async (tx) => {
      // Lock the due and re-check the balance, so two people receiving the same amount at once
      // can't both succeed (the check above may be out of date by now).
      await tx.$queryRaw`SELECT id FROM "Due" WHERE id = ${due.id} FOR UPDATE`;
      const fresh = await tx.due.findUniqueOrThrow({ where: { id: due.id }, include: { payments: { select: { amount: true, voidedAt: true } } } });
      const left = dueBalance(fresh, fresh.payments);
      if (fresh.status !== "OPEN" || amount > left) throw new BalanceError(left > 0 ? `Only ${rupees(left)} is still due on "${due.label}"` : `"${due.label}" is already paid`);
      return recordPayment(tx, {
        profileId: due.profileId, kind: due.kind, amount, mode: MODE.catch("CASH").parse(fd.get("mode")),
        reference: str(fd, "reference"), paidAt, dueId: due.id, membershipId: due.membershipId,
        description: due.label, notes: str(fd, "notes"), userId: user.id,
      });
    });
  } catch (e) {
    if (e instanceof BalanceError) back(due.profileId, e.message, "error");
    throw e;
  }
  refresh(due.profileId);
  if (fd.get("returnTo") === "payments") redirect(`/payments?ok=${encodeURIComponent(`Receipt ${p.receiptNo}: ${rupees(amount)} received`)}`);
  back(due.profileId, `Receipt ${p.receiptNo}: ${rupees(amount)} received for ${due.label}`);
}

export async function editDueAmount(fd: FormData) {
  const user = await requireUser();
  const dueId = z.string().parse(fd.get("dueId"));
  const due = await prisma.due.findUnique({ where: { id: dueId }, include: { payments: { select: { amount: true, voidedAt: true } } } });
  if (!due) redirect("/payments");
  const amount = money(fd, "amount");
  if (amount == null || Number.isNaN(amount)) back(due.profileId, "Enter an amount", "error");
  if (amount === due.amount) back(due.profileId, "The amount is unchanged");
  // Lowering what a client owes is a discount/write-off: owner only (like waiving)
  if (amount < due.amount && user.role !== "OWNER") back(due.profileId, "Only the owner can lower an amount", "error");
  const paid = due.amount - dueBalance({ ...due, status: "OPEN" }, due.payments);
  if (amount < paid) back(due.profileId, `${rupees(paid)} has already been paid on this`, "error");
  const stamp = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const history = `Amount changed ${rupees(due.amount)} → ${rupees(amount)} by ${user.name}, ${stamp}`;
  await prisma.$transaction(async (tx) => {
    await tx.due.update({ where: { id: dueId }, data: { amount, notes: due.notes ? `${due.notes}\n${history}` : history } });
    await refreshDue(tx, dueId);
  });
  refresh(due.profileId);
  back(due.profileId, `${due.label}: amount changed to ${rupees(amount)}`);
}

// ───────────── Owner only ─────────────

export async function waiveDue(fd: FormData) {
  const user = await requireOwner();
  const dueId = z.string().parse(fd.get("dueId"));
  const due = await prisma.due.findUnique({ where: { id: dueId } });
  if (!due) redirect("/payments");
  const line = `Waived by ${user.name}${str(fd, "reason") ? `: ${str(fd, "reason")}` : ""}`;
  // Only an open due can be waived (it may have been paid meanwhile in another tab)
  const r = await prisma.due.updateMany({
    where: { id: dueId, status: "OPEN" },
    data: { status: "WAIVED", notes: due.notes ? `${due.notes}\n${line}` : line },
  });
  if (r.count === 0) back(due.profileId, `${due.label} is no longer open`, "error");
  refresh(due.profileId);
  back(due.profileId, `${due.label} waived`);
}

export async function voidPayment(fd: FormData) {
  const user = await requireOwner();
  const id = z.string().parse(fd.get("paymentId"));
  const reason = str(fd, "reason");
  const p = await prisma.payment.findUnique({ where: { id } });
  if (!p) redirect("/payments");
  // Back to the receipt itself (works even when the profile was deleted)
  if (!reason) redirect(`/payments/${id}/receipt?error=${encodeURIComponent("Give a reason to void a receipt")}`);
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
