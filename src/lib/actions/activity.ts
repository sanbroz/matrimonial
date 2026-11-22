"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { fromDateTimeInputIST } from "@/lib/format";

const target = z
  .object({ leadId: z.string().optional(), profileId: z.string().optional() })
  .refine((t) => !!t.leadId !== !!t.profileId, "Exactly one target");

function targetFrom(fd: FormData) {
  return target.parse({
    leadId: (fd.get("leadId") as string) || undefined,
    profileId: (fd.get("profileId") as string) || undefined,
  });
}

function pathFor(t: { leadId?: string; profileId?: string }) {
  return t.leadId ? `/leads/${t.leadId}` : `/profiles/${t.profileId}`;
}

export async function addNote(fd: FormData) {
  const user = await requireUser();
  const t = targetFrom(fd);
  const body = String(fd.get("body") ?? "").trim();
  const kind = z.enum(["CALL", "VISIT", "WHATSAPP", "OTHER"]).catch("OTHER").parse(fd.get("kind"));
  if (!body) return;
  await prisma.note.create({ data: { ...t, body, kind, authorId: user.id } });

  // Optional follow-up scheduled from the same form
  const followAt = fromDateTimeInputIST(String(fd.get("followUpAt") ?? ""));
  if (followAt) {
    const title = String(fd.get("followUpTitle") ?? "").trim() || "Call back";
    await prisma.followUp.create({ data: { ...t, title, dueAt: followAt, createdById: user.id, assignedToId: user.id } });
  }
  revalidatePath(pathFor(t));
}

export async function addFollowUp(fd: FormData) {
  const user = await requireUser();
  const t = targetFrom(fd);
  const dueAt = fromDateTimeInputIST(String(fd.get("dueAt") ?? ""));
  const title = String(fd.get("title") ?? "").trim() || "Call back";
  if (!dueAt) return;
  await prisma.followUp.create({ data: { ...t, title, dueAt, createdById: user.id, assignedToId: user.id } });
  revalidatePath(pathFor(t));
  revalidatePath("/");
}

export async function markFollowUpDone(fd: FormData) {
  await requireUser();
  const id = z.string().parse(fd.get("id"));
  const f = await prisma.followUp.findUnique({ where: { id } });
  if (!f) return; // already removed
  await prisma.followUp.updateMany({ where: { id, done: false }, data: { done: true, doneAt: new Date() } });
  revalidatePath("/");
  revalidatePath(pathFor({ leadId: f.leadId ?? undefined, profileId: f.profileId ?? undefined }));
}

export async function deleteNote(fd: FormData) {
  const user = await requireUser();
  const id = z.string().parse(fd.get("id"));
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) return;
  // Staff can delete their own notes; the owner can delete any.
  if (note.authorId !== user.id && user.role !== "OWNER") return;
  await prisma.note.deleteMany({ where: { id } });
  revalidatePath(pathFor({ leadId: note.leadId ?? undefined, profileId: note.profileId ?? undefined }));
}
