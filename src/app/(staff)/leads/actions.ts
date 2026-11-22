"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SOURCE_LABELS } from "@/lib/lead-labels";
import { prisma } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth/server";
import { ParseError, normalisePhone } from "@/lib/parse";
import { fromDateTimeInputIST } from "@/lib/format";

export type LeadFormState = { error?: string; values?: Record<string, string>; ts?: number };

const leadSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().trim().min(1, "Phone is required"),
  altPhone: z.string().trim().optional(),
  source: z.enum(Object.keys(SOURCE_LABELS) as [keyof typeof SOURCE_LABELS, ...(keyof typeof SOURCE_LABELS)[]]),
  forWhom: z.string().trim().optional(),
  gender: z.enum(["MALE", "FEMALE", ""]).optional(),
  city: z.string().trim().optional(),
  details: z.string().trim().optional(),
  status: z.enum(["NEW", "FOLLOW_UP", "CONVERTED", "LOST"]).optional(),
  lostReason: z.string().trim().optional(),
});

function readLead(fd: FormData) {
  const values = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const r = leadSchema.safeParse(values);
  if (!r.success) return { values, error: r.error.issues[0].message };
  try {
    const d = r.data;
    return {
      values,
      data: {
        name: d.name,
        phone: normalisePhone(d.phone)!,
        altPhone: normalisePhone(d.altPhone) ?? null,
        source: d.source,
        forWhom: d.forWhom || null,
        gender: d.gender || null,
        city: d.city || null,
        details: d.details || null,
        ...(d.status ? { status: d.status } : {}),
        lostReason: d.status === "LOST" ? d.lostReason || null : null,
      },
    };
  } catch (e) {
    return { values, error: e instanceof ParseError ? e.message : "Invalid input" };
  }
}

export async function createLeadAction(_prev: LeadFormState, fd: FormData): Promise<LeadFormState> {
  const user = await requireUser();
  const r = readLead(fd);
  if (!r.data) return { error: r.error, values: r.values, ts: Date.now() };
  const followAt = fromDateTimeInputIST(String(fd.get("followUpAt") ?? ""));
  // One transaction: the lead and its call-back are saved together or not at all
  const lead = await prisma.lead.create({
    data: {
      ...r.data,
      ...(followAt ? { status: "FOLLOW_UP" as const } : {}),
      createdById: user.id,
      assignedToId: user.id,
      ...(followAt
        ? { followUps: { create: { title: "Call back lead", dueAt: followAt, createdById: user.id, assignedToId: user.id } } }
        : {}),
    },
  });
  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function updateLeadAction(id: string, _prev: LeadFormState, fd: FormData): Promise<LeadFormState> {
  await requireUser();
  const r = readLead(fd);
  if (!r.data) return { error: r.error, values: r.values, ts: Date.now() };
  const res = await prisma.lead.updateMany({ where: { id }, data: r.data });
  if (res.count === 0) return { error: "This lead no longer exists (it may have been deleted).", values: r.values, ts: Date.now() };
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  redirect(`/leads/${id}?saved=1`);
}

export async function deleteLeadAction(fd: FormData) {
  await requireOwner();
  const id = z.string().parse(fd.get("id"));
  await prisma.lead.deleteMany({ where: { id } });
  revalidatePath("/leads");
  redirect("/leads");
}
