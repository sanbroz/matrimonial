"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { isChannel } from "@/lib/lead-forms";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (msg: string, key: "ok" | "error" = "ok"): never => redirect(`/leads/forms?${key}=${encodeURIComponent(msg)}`);
/** Short, unguessable link part (10 letters/digits) */
const token = () => {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return [...randomBytes(10)].map((b) => abc[b % abc.length]).join("");
};

export async function createLeadForm(fd: FormData) {
  const user = await requireUser();
  const name = str(fd, "name").slice(0, 80);
  const channel = str(fd, "channel");
  if (!name) back("Give the link a name, e.g. \"Instagram Diwali post\"", "error");
  if (!isChannel(channel)) back("Choose where the link will be used", "error");
  const f = await prisma.leadForm.create({
    data: { token: token(), name, channel, heading: str(fd, "heading").slice(0, 120) || null, message: str(fd, "message").slice(0, 400) || null, createdById: user.id },
  });
  revalidatePath("/leads/forms");
  redirect(`/leads/forms?ok=${encodeURIComponent(`Link "${f.name}" created`)}#form-${f.id}`);
}

export async function updateLeadForm(fd: FormData) {
  await requireUser();
  const id = str(fd, "id");
  const op = str(fd, "op");
  if (op === "toggle") {
    const f = await prisma.leadForm.findUnique({ where: { id }, select: { active: true } });
    if (f) await prisma.leadForm.update({ where: { id }, data: { active: !f.active } });
    revalidatePath("/leads/forms");
    back(f?.active ? "Link switched off: it now shows \"form closed\"" : "Link switched on");
  }
  const name = str(fd, "name").slice(0, 80);
  if (!name) back("The name can't be empty", "error");
  await prisma.leadForm.update({
    where: { id },
    data: { name, heading: str(fd, "heading").slice(0, 120) || null, message: str(fd, "message").slice(0, 400) || null },
  });
  revalidatePath("/leads/forms");
  back("Saved");
}
