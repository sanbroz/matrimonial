/**
 * Default data every bureau needs: the settings row and the default dropdown lists.
 * Safe to run any number of times (never overwrites the owner's edits).
 * Plain Node (no Next.js imports): also used by ops/migrate-all.ts.
 */
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_OPTIONS } from "../options-defaults";

export async function seedBureauDefaults(db: PrismaClient, bureauName?: string) {
  await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, ...(bureauName ? { bureauName } : {}) } });
  for (const [category, values] of Object.entries(DEFAULT_OPTIONS)) {
    const count = await db.optionItem.count({ where: { category } });
    if (count > 0) continue;
    await db.optionItem.createMany({
      data: values.map((value, i) => ({ category, value, sortOrder: i })),
      skipDuplicates: true,
    });
  }
}

/** The bureau's first owner (only when it has no owner yet). */
export async function createFirstOwner(db: PrismaClient, owner: { name: string; email: string; password: string }) {
  if ((await db.user.count({ where: { role: "OWNER" } })) > 0) return false;
  await db.user.create({
    data: {
      name: owner.name || "Owner",
      email: owner.email.toLowerCase().trim(),
      role: "OWNER",
      passwordHash: await bcrypt.hash(owner.password, 10),
    },
  });
  return true;
}
