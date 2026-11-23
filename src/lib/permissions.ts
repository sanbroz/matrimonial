/** What a staff member may do (the owner sets this per person in Settings → Staff). Owners can do everything. Pure, unit-tested. */
export const PERMISSIONS = {
  payments: { label: "Payments and dues", hint: "See dues and record payments", default: true },
  reports: { label: "Reports and Excel export", hint: "Reports page and downloading all profiles / leads (with phone numbers)", default: false },
  delete: { label: "Delete profiles and leads", hint: "Permanently delete records", default: false },
} as const;
export type Permission = keyof typeof PERMISSIONS;
export type Permissions = Record<Permission, boolean>;

const KEYS = Object.keys(PERMISSIONS) as Permission[];

/** A staff member's saved switches; anything missing uses the default. */
export function readPermissions(raw: unknown): Permissions {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(KEYS.map((k) => [k, typeof o[k] === "boolean" ? (o[k] as boolean) : PERMISSIONS[k].default])) as Permissions;
}

export function permissionsFor(role: "OWNER" | "STAFF", raw: unknown): Permissions {
  if (role === "OWNER") return Object.fromEntries(KEYS.map((k) => [k, true])) as Permissions;
  return readPermissions(raw);
}

/** From the staff form: one checkbox per permission, named "perm_<key>". */
export function permissionsFromForm(fd: { get(name: string): unknown }): Permissions {
  return Object.fromEntries(KEYS.map((k) => [k, fd.get(`perm_${k}`) === "on"])) as Permissions;
}
