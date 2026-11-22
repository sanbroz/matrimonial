"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";

export async function saveStory(fd: FormData) {
  await requireUser();
  const id = z.string().parse(fd.get("id"));
  const d = String(fd.get("marriedOn") ?? "");
  const marriedOn = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00Z`) : null;
  await prisma.proposal.updateMany({
    where: { id, status: "MATCHED" },
    data: { marriedOn, storyNote: String(fd.get("storyNote") ?? "").trim().slice(0, 500) || null },
  });
  revalidatePath("/matched");
  redirect("/matched?ok=Saved");
}
