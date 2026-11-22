import type { ProposalStatus } from "@prisma/client";

export const PROPOSAL_LABELS: Record<ProposalStatus, string> = {
  SHARED: "Shared",
  INTERESTED: "Interested",
  DECLINED: "Declined",
  MEETING_SCHEDULED: "Meeting scheduled",
  MET: "Met",
  MATCHED: "Matched",
  DROPPED: "Dropped",
};

export const PROPOSAL_TONE = {
  SHARED: "blue",
  INTERESTED: "green",
  DECLINED: "zinc",
  MEETING_SCHEDULED: "amber",
  MET: "amber",
  MATCHED: "brand",
  DROPPED: "zinc",
} as const;

/** Days without activity after which an open proposal needs a call. */
export const QUIET_DAYS: Partial<Record<ProposalStatus, number>> = { SHARED: 5, INTERESTED: 5, MET: 7 };

export function needsAttention(p: { status: ProposalStatus; updatedAt: Date; meetingAt: Date | null }, now = new Date()) {
  if (p.status === "MEETING_SCHEDULED") return !!p.meetingAt && p.meetingAt.getTime() < now.getTime() - 24 * 3600 * 1000;
  const days = QUIET_DAYS[p.status];
  return days != null && now.getTime() - p.updatedAt.getTime() > days * 24 * 3600 * 1000;
}
