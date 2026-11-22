import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_OPTIONS } from "../src/lib/options-defaults";

const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const email = process.env.OWNER_EMAIL?.toLowerCase().trim();
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) throw new Error("Set OWNER_EMAIL and OWNER_PASSWORD in .env");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name: process.env.OWNER_NAME || "Owner",
        email,
        role: "OWNER",
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    console.log(`Created owner account ${email} (password is in .env)`);
  } else {
    console.log(`Owner account ${email} already exists`);
  }

  // Default dropdown suggestions — only added if the category is empty,
  // so the owner's edits are never overwritten.
  for (const [category, values] of Object.entries(DEFAULT_OPTIONS)) {
    const count = await prisma.optionItem.count({ where: { category } });
    if (count > 0) continue;
    await prisma.optionItem.createMany({
      data: values.map((value, i) => ({ category, value, sortOrder: i })),
      skipDuplicates: true,
    });
  }
  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
