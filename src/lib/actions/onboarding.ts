"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth/server";

/** Hide the dashboard's "Getting started" checklist for good. */
export async function dismissGettingStarted() {
  await requireOwner();
  await prisma.settings.update({ where: { id: 1 }, data: { onboardingDone: true } });
  revalidatePath("/");
}
