import { PROFILE_FIELDS, inputName } from "./profile-fields";

export type FormValues = Record<string, string | string[] | boolean>;

/** DB record → values for the profile form inputs. */
export function profileToFormValues(
  profile: Record<string, unknown> | null,
  preference: Record<string, unknown> | null,
): FormValues {
  const out: FormValues = {};
  for (const f of PROFILE_FIELDS) {
    const src = f.pref ? preference : profile;
    const v = src?.[f.key];
    const name = inputName(f);
    if (v == null) continue;
    if (f.type === "date" && v instanceof Date) out[name] = v.toISOString().slice(0, 10);
    else if (f.type === "bool") out[name] = Boolean(v);
    else if (f.type === "maritalList") out[name] = v as string[];
    else if (Array.isArray(v)) out[name] = v.join(", ");
    else out[name] = String(v);
  }
  if (profile) {
    for (const k of ["status", "urgent", "vip", "specialCase", "consentGiven"]) {
      const v = profile[k];
      if (v != null) out[k] = typeof v === "boolean" ? v : String(v);
    }
  }
  return out;
}

/** FormData → raw values keyed by input name (checkboxes missing = unchecked). */
export function formDataToValues(fd: FormData): FormValues {
  const out: FormValues = {};
  for (const f of PROFILE_FIELDS) {
    const name = inputName(f);
    if (f.type === "maritalList") out[name] = fd.getAll(name).map(String);
    else if (f.type === "bool") out[name] = fd.get(name) === "on";
    else out[name] = String(fd.get(name) ?? "");
  }
  for (const k of ["urgent", "vip", "specialCase", "consentGiven"]) out[k] = fd.get(k) === "on";
  out.status = String(fd.get("status") ?? "ACTIVE");
  return out;
}
