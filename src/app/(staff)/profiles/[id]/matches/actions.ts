"use server";

import { clearPendingMatchesCache } from "@/lib/services/matching";
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
  await clearPendingMatchesCache();
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
    // upsert: two people recording the same share at once can't fail on the unique pair
    await prisma.proposal.upsert({
      where: { fromProfileId_toProfileId: { fromProfileId: client!.id, toProfileId: candidateId } },
      update: {},
      create: {
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
  if (status === "MEETING_SCHEDULED" && !meetingAt && !current.meetingAt) {
    throw new Error("Please give the meeting date and time");
  }
  if (current.status === status && !note && !meetingAt) return; // nothing to save

  const details = [
    status === "MEETING_SCHEDULED" && meetingAt ? `Meeting: ${formatDateTime(meetingAt)}` : null,
    status === "DECLINED" && declineReason ? `Reason: ${declineReason}` : null,
    note,
  ].filter(Boolean).join(" · ") || null;

  await prisma.$transaction(async (tx) => {
    // Lock the proposal and re-read its stage, so two simultaneous "Matched" saves can't bill twice
    await tx.$queryRaw`SELECT id FROM "Proposal" WHERE id = ${id} FOR UPDATE`;
    const fresh = await tx.proposal.findUniqueOrThrow({ where: { id }, select: { status: true } });
    const changed = fresh.status !== status;
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
    // Only when it BECOMES matched: a later note must not re-mark profiles or re-bill
    const becameMatched = changed && status === "MATCHED";
    if (becameMatched && fd.get("markProfiles") === "on") {
      await tx.profile.updateMany({ where: { id: { in: [current.fromProfileId, current.toProfileId] } }, data: { status: "MATCHED" } });
      // Their other open proposals are over: close them so nobody keeps calling about them
      const pair = [current.fromProfileId, current.toProfileId];
      const others = await tx.proposal.findMany({
        where: {
          id: { not: id },
          status: { in: ["SHARED", "INTERESTED", "MEETING_SCHEDULED", "MET"] },
          OR: [{ fromProfileId: { in: pair } }, { toProfileId: { in: pair } }],
        },
        select: { id: true },
      });
      if (others.length) {
        await tx.proposal.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { status: "DROPPED" } });
        await tx.proposalEvent.createMany({
          data: others.map((o) => ({
            proposalId: o.id,
            status: "DROPPED" as const,
            note: `Closed: ${current.fromProfile.code} and ${current.toProfile.code} are matched`,
            userId: user.id,
          })),
        });
      }
    }
    if (becameMatched && fd.get("successFees") === "on") {
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
  const p = await prisma.proposal.findUnique({ where: { id } });
  if (!p) return; // already removed (e.g. in another tab)
  // Success-fee dues stay (proposalId becomes empty): cancelling money owed is the owner's call (waive),
  // and the double-billing check still recognises them if the couple is matched again.
  await prisma.proposal.deleteMany({ where: { id } });
  revalidatePath(`/profiles/${p.fromProfileId}`);
  revalidatePath(`/profiles/${p.fromProfileId}/matches`);
  revalidatePath(`/profiles/${p.toProfileId}`);
}

/** Star / unstar a suggested profile for this family (Shortlist). */
export async function toggleShortlist(fd: FormData) {
  const user = await requireUser();
  const clientId = z.string().parse(fd.get("clientId"));
  const candidateId = z.string().parse(fd.get("candidateId"));
  const existing = await prisma.shortlist.findUnique({ where: { clientId_candidateId: { clientId, candidateId } } });
  if (existing) await prisma.shortlist.delete({ where: { id: existing.id } });
  else {
    const both = await prisma.profile.count({ where: { id: { in: [clientId, candidateId] } } });
    if (both === 2) await prisma.shortlist.create({ data: { clientId, candidateId, createdById: user.id } });
  }
  revalidatePath(`/profiles/${clientId}/matches`);
  revalidatePath(`/profiles/${clientId}`);
}

/**
 * The other direction: this profile's biodata goes to the selected families (e.g. a new profile that
 * suits several existing clients). Records "shared" from each family, then opens the share page.
 */
export async function sendToFamilies(fd: FormData) {
  const user = await requireUser();
  const profileId = z.string().parse(fd.get("for"));
  const familyIds = [...new Set(fd.getAll("id").map(String))].slice(0, 100);
  const profile = await prisma.profile.findUnique({ where: { id: profileId }, select: { id: true, gender: true, code: true } });
  if (!profile || !familyIds.length) redirect(`/profiles/${profileId}/matches`);
  const families = await prisma.profile.findMany({ where: { id: { in: familyIds }, gender: { not: profile!.gender } }, select: { id: true } });
  let created = 0;
  for (const f of families) {
    const exists = await prisma.proposal.findUnique({ where: { fromProfileId_toProfileId: { fromProfileId: f.id, toProfileId: profileId } } });
    if (exists) continue;
    await prisma.proposal.create({
      data: { fromProfileId: f.id, toProfileId: profileId, createdById: user.id, events: { create: { status: "SHARED", userId: user.id, note: `Biodata of ${profile!.code} sent` } } },
    });
    created++;
  }
  revalidatePath(`/profiles/${profileId}`);
  revalidatePath(`/profiles/${profileId}/matches`);
  await clearPendingMatchesCache();
  redirect(`/share?id=${profileId}&ok=${encodeURIComponent(`Recorded: ${profile!.code}'s biodata sent to ${created} famil${created === 1 ? "y" : "ies"}. Download or send it below.`)}`);
}
