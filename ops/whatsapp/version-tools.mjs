// Version comparison for npm versions incl. pre-releases written either way
// ("7.0.0-rc.9", "7.0.0-rc10"): numbers inside labels compare as numbers.
export function compareVersions(a, b) {
  const parse = (v) => {
    const [core, ...pre] = String(v).trim().replace(/^v/, "").split("-");
    return { core: core.split(".").map((n) => parseInt(n, 10) || 0), pre: pre.join("-") };
  };
  const A = parse(a);
  const B = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (A.core[i] ?? 0) - (B.core[i] ?? 0);
    if (d) return Math.sign(d);
  }
  if (!A.pre && !B.pre) return 0;
  if (!A.pre) return 1; // a release beats any pre-release
  if (!B.pre) return -1;
  // natural compare of the pre-release label
  const chunks = (s) => s.match(/\d+|[a-z]+/gi) ?? [];
  const ca = chunks(A.pre);
  const cb = chunks(B.pre);
  for (let i = 0; i < Math.max(ca.length, cb.length); i++) {
    const x = ca[i];
    const y = cb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) {
      const d = Number(x) - Number(y);
      if (d) return Math.sign(d);
    } else if (nx !== ny) return nx ? -1 : 1;
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export const VERSION_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
