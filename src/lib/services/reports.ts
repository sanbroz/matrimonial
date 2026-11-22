import "server-only";
import { prisma } from "@/lib/db";
import { dueBalance, todayIST } from "@/lib/money";

/** Open dues with their remaining balance, oldest first. */
export async function openDues() {
  const dues = await prisma.due.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    include: {
      payments: { select: { amount: true, voidedAt: true } },
      profile: { select: { id: true, code: true, fullName: true, contactName: true, phone: true, status: true } },
    },
  });
  return dues.map((d) => ({ ...d, balance: dueBalance(d, d.payments) })).filter((d) => d.balance > 0);
}

/**
 * Memberships that need renewing: the latest membership of each profile that ends within
 * `aheadDays`, or ended up to `behindDays` ago (profiles not matched/closed).
 */
export async function renewalsDue(aheadDays = 14, behindDays = 30) {
  const today = todayIST();
  const from = new Date(today.getTime() - behindDays * 86400000);
  const to = new Date(today.getTime() + aheadDays * 86400000);
  const candidates = await prisma.membership.findMany({
    where: { endDate: { gte: from, lte: to }, profile: { status: { in: ["ACTIVE", "ON_HOLD"] } } },
    orderBy: { endDate: "asc" },
    include: {
      plan: { select: { name: true } },
      profile: { select: { id: true, code: true, fullName: true, contactName: true, phone: true } },
    },
  });
  if (!candidates.length) return [];
  // Drop those already renewed (a later membership exists)
  const later = await prisma.membership.findMany({
    where: { profileId: { in: candidates.map((c) => c.profileId) } },
    select: { profileId: true, endDate: true },
  });
  return candidates.filter((c) => !later.some((l) => l.profileId === c.profileId && l.endDate > c.endDate));
}

/** Month range [start, end) in IST for "2026-11". */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1) - 330 * 60000);
  const end = new Date(Date.UTC(y, m, 1) - 330 * 60000);
  return { start, end };
}

export function currentMonth(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function collections(month: string) {
  const { start, end } = monthRange(month);
  return prisma.payment.findMany({
    where: { paidAt: { gte: start, lt: end } },
    orderBy: { paidAt: "asc" },
    include: { createdBy: { select: { name: true } } },
  });
}
