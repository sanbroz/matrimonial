"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";

const ALLOWED = ["q", "gender", "status", "religion", "caste", "marital", "country", "education", "ageMin", "ageMax", "flag"];

export async function saveSearch(fd: FormData) {
  const user = await requireUser();
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  // Keep only known filter keys (never store arbitrary input as a URL)
  const src = new URLSearchParams(String(fd.get("query") ?? ""));
  const clean = new URLSearchParams();
  for (const k of ALLOWED) {
    const v = src.get(k);
    if (v) clean.set(k, v.slice(0, 100));
  }
  const query = clean.toString();
  if (!name || !query) redirect(`/profiles?${query}`);
  await prisma.savedSearch.create({ data: { name, query, userId: user.id } });
  revalidatePath("/profiles");
  redirect(`/profiles?${query}`);
}

export async function deleteSearch(fd: FormData) {
  const user = await requireUser();
  const id = z.string().parse(fd.get("id"));
  const s = await prisma.savedSearch.findUnique({ where: { id } });
  if (s && (s.userId === user.id || user.role === "OWNER")) await prisma.savedSearch.delete({ where: { id } });
  revalidatePath("/profiles");
}
