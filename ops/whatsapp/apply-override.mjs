// Build step: if BAILEYS_VERSION (set by the updater in .env.production) is NEWER than the version
// in package.json, install it. An older override is ignored, so an app release that ships a newer
// Baileys always wins.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { VERSION_RE, compareVersions } from "./version-tools.mjs";

const want = (process.env.BAILEYS_VERSION || "").trim();
const have = JSON.parse(readFileSync("node_modules/baileys/package.json", "utf8")).version;

if (!want) {
  console.log(`baileys ${have} (from package.json)`);
} else if (!VERSION_RE.test(want)) {
  console.error(`BAILEYS_VERSION "${want}" is not a valid version; keeping ${have}`);
} else if (compareVersions(want, have) <= 0) {
  console.log(`BAILEYS_VERSION ${want} is not newer than ${have}; keeping ${have}`);
} else {
  console.log(`installing baileys ${want} (package.json has ${have})`);
  execFileSync("npm", ["install", `baileys@${want}`, "--omit=dev", "--no-save", "--no-audit", "--no-fund"], { stdio: "inherit" });
  const now = JSON.parse(readFileSync("node_modules/baileys/package.json", "utf8")).version;
  if (now !== want) throw new Error(`expected baileys ${want}, got ${now}`);
}
