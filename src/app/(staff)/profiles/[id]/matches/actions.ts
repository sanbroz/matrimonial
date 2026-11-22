"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { formatDateTime, fromDateTimeInputIST } from "@/lib/format";
import { createSuccessFeeDues } from "@/lib/services/money";

/**
 * Record that the candidate's biodata was shared with the client's family.
 * The candidate then disappears from the client's suggestions.
 */
export async function shareMatch(fd: FormData) {
  const user = await requireUser();
  const clientId = z.string().parse(fd.get("clientId"));
  const candidateId = z.string().parse(fd.get("candidateId"));
  const [client, candidate] = await Promise.all([
    prisma.profile.findUnique({ where: { id: clientId }, select: { gender: true } }),
    prisma.profile.findUnique({ where: { id: candidateId }, select: { gender: true } }),
  ]);
  if (!client || !candidate || client.gender === candidate.gender) return;
  await prisma.proposal.upsert({
    where: { fromProfileId_toProfileId: { fromProfileId: clientId, toProfileId: candidateId } },
    update: {},
    create: {
      fromProfileId: clientId,
      toProfileId: candidateId,
      createdById: user.id,
      notes: String(fd.get("notes") ?? "").trim() || null,
      events: { create: { status: "SHARED", userId: user.id, note: "Biodata shared" } },
    },
  });
  const back = String(fd.get("returnTo") ?? "");
  if (back.startsWith("/profiles/")) {
    revalidatePath(back.split("?")[0]);
    redirect(back);
  }
  revalidatePath(`/profiles/${clientId}/matches`);
  revalidatePath(`/profiles/${clientId}`);
  revalidatePath(`/profiles/${candidateId}`);
}

/**
 * From a biodata page: "I sent this biodata (candidateId) to the family of profile <code>".
 * Returns to the biodata page with a message.
 */
export async function shareByCode(fd: FormData) {
  const user = await requireUser();
  const candidateId = z.string().parse(fd.get("candidateId"));
  const lang = String(fd.get("lang") ?? "");
  const code = String(fd.get("clientCode") ?? "").trim().toUpperCase();
  const back = (msg: string, key = "ok") =>
    redirect(`/profiles/${candidateId}/biodata?lang=${lang}&${key}=${encodeURIComponent(msg)}`);
  if (!code) back("Enter the profile code of the family you sent it to", "error");
  const [client, candidate] = await Promise.all([
    prisma.profile.findFirst({ where: { code: { equals: code, mode: "insensitive" } }, select: { id: true, code: true, gender: true } }),
    prisma.profile.findUnique({ where: { id: candidateId }, select: { gender: true } }),
  ]);
  if (!client || !candidate) back(`No profile with code ${code}`, "error");
  if (client!.gender === candidate!.gender) back(`${client!.code} is the same gender as this profile`, "error");
  const existing = await prisma.proposal.findUnique({
    where: { fromProfileId_toProfileId: { fromProfileId: client!.id, toProfileId: candidateId } },
  });
  if (!existing) {
    await prisma.proposal.create({
      data: {
        fromProfileId: client!.id,
        toProfileId: candidateId,
        createdById: user.id,
        events: { create: { status: "SHARED", userId: user.id, note: "Biodata shared" } },
      },
    });
  }
  revalidatePath(`/profiles/${client!.id}`);
  revalidatePath(`/profiles/${candidateId}`);
  back(existing ? `Already recorded as shared with ${client!.code}` : `Recorded: shared with ${client!.code}'s family`);
}

const STATUS = z.enum(["SHARED", "INTERESTED", "DECLINED", "MEETING_SCHEDULED", "MET", "MATCHED", "DROPPED"]);

/**
 * Change a proposal's stage, logging it on the timeline.
 *  - MEETING_SCHEDULED: stores the meeting time and adds a follow-up for the day after
 *  - DECLINED: stores the reason
 *  - MATCHED: optionally marks both profiles as Matched
 * A note alone (same status) just adds a timeline entry.
 */
export async function updateProposalStatus(fd: FormData) {
  const user = await requireUser();
  const id = z.string().parse(fd.get("id"));
  const status = STATUS.parse(fd.get("status"));
  const note = String(fd.get("note") ?? "").trim() || null;
  const meetingAt = fromDateTimeInputIST(String(fd.get("meetingAt") ?? ""));
  const declineReason = String(fd.get("declineReason") ?? "").trim() || null;

  const current = await prisma.proposal.findUnique({
    where: { id },
    include: { fromProfile: { select: { code: true } }, toProfile: { select: { code: true } } },
  });
  if (!current) return;
  const changed = current.status !== status;
  if (!changed && !note && !meetingAt) return;

  const details = [
    status === "MEETING_SCHEDULED" && meetingAt ? `Meeting: ${formatDateTime(meetingAt)}` : null,
    status === "DECLINED" && declineReason ? `Reason: ${declineReason}` : null,
    note,
  ].filter(Boolean).join(" · ") || null;

  await prisma.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id },
      data: {
        status,
        matchedAt: status === "MATCHED" ? (current.matchedAt ?? new Date()) : null,
        ...(meetingAt ? { meetingAt } : {}),
        ...(status === "DECLINED" ? { declineReason } : {}),
      },
    });
    await tx.proposalEvent.create({ data: { proposalId: id, status, note: details, userId: user.id } });

    if (status === "MEETING_SCHEDULED" && meetingAt) {
      const dayAfter = new Date(meetingAt.getTime() + 24 * 3600 * 1000);
      await tx.followUp.create({
        data: {
          profileId: current.fromProfileId,
          title: `Ask how the meeting with ${current.toProfile.code} went`,
          dueAt: dayAfter,
          createdById: user.id,
          assignedToId: user.id,
        },
      });
    }
    if (status === "MATCHED" && fd.get("markProfiles") === "on") {
      await tx.profile.updateMany({ where: { id: { in: [current.fromProfileId, current.toProfileId] } }, data: { status: "MATCHED" } });
    }
    if (status === "MATCHED" && fd.get("successFees") === "on") {
      const billed = await createSuccessFeeDues(tx, id);
      if (billed.length) {
        await tx.proposalEvent.create({
          data: { proposalId: id, status, note: `Success fee due added for ${billed.join(" and ")}`, userId: user.id },
        });
      }
    }
  });

  revalidatePath(`/profiles/${current.fromProfileId}`);
  revalidatePath(`/profiles/${current.toProfileId}`);
  revalidatePath("/pipeline");
  revalidatePath("/");
}

export async function removeProposal(fd: FormData) {
  await requireUser();
  const id = z.string().parse(fd.get("id"));
  const p = await prisma.proposal.delete({ where: { id } });
  revalidatePath(`/profiles/${p.fromProfileId}`);
  revalidatePath(`/profiles/${p.fromProfileId}/matches`);
  revalidatePath(`/profiles/${p.toProfileId}`);
}
