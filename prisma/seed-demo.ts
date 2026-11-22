/**
 * Demo (sample) data for one bureau, from the command line:
 *   npm run db:seed-demo                 → bureau "matrimonial" (FIRST_TENANT_SLUG)
 *   npm run db:seed-demo -- sharma       → bureau "sharma"
 *   npm run db:seed-demo -- sharma --delete
 * The same data the app adds with Settings → Demo data (src/lib/demo-data.ts).
 */
import { PrismaClient } from "@prisma/client";
import { databaseUrlFor } from "../src/lib/tenant/db-url";
import { schemaForSlug } from "../src/lib/tenant/host";
import { deleteDemoData, loadDemoData } from "../src/lib/demo-data";

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith("--")) ?? process.env.FIRST_TENANT_SLUG ?? "matrimonial";
  const db = new PrismaClient({ datasourceUrl: databaseUrlFor(schemaForSlug(slug), 2) });
  try {
    if (args.includes("--delete")) {
      const r = await deleteDemoData(db);
      console.log(`${slug}: deleted ${r.profiles} demo profiles, ${r.leads} leads, ${r.payments} receipts` + (r.files.length ? ` (${r.files.length} uploaded files left on disk)` : ""));
    } else {
      const r = await loadDemoData(db);
      console.log(`${slug}: added ${r.profiles} profiles, ${r.leads} leads, ${r.proposals} proposals, ${r.receipts} receipts`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
