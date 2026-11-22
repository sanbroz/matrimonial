// node ops/whatsapp/version-tools.test.mjs
import assert from "node:assert/strict";
import { compareVersions as c } from "./version-tools.mjs";

assert.equal(c("7.0.0-rc14", "7.0.0-rc14"), 0);
assert.equal(c("7.0.0-rc.9", "7.0.0-rc10"), -1); // mixed naming, 9 < 10
assert.equal(c("7.0.0-rc14", "7.0.0-rc13"), 1);
assert.equal(c("7.0.0", "7.0.0-rc14"), 1); // release beats pre-release
assert.equal(c("6.7.24", "7.0.0-rc1"), -1);
assert.equal(c("7.1.0", "7.0.9"), 1);
assert.equal(c("v7.0.1", "7.0.0"), 1);
console.log("version-tools: all good");
