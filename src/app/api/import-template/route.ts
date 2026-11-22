import Papa from "papaparse";
import { getCurrentUser } from "@/lib/auth/server";
import { PROFILE_FIELDS } from "@/lib/profile-fields";

/** Blank CSV whose headers match the field labels, so every column maps automatically. */
export async function GET() {
  if (!(await getCurrentUser())) return new Response("Not signed in", { status: 401 });
  const headers = PROFILE_FIELDS.filter((f) => !f.pref).map((f) => f.label);
  const example = PROFILE_FIELDS.filter((f) => !f.pref).map((f) => EXAMPLE[f.key] ?? "");
  const csv = "﻿" + Papa.unparse([headers, example]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="profiles-import-template.csv"',
    },
  });
}

const EXAMPLE: Record<string, string> = {
  fullName: "Example Kaur (delete this row)",
  gender: "Female",
  dob: "15/08/1997",
  heightCm: `5'4"`,
  maritalStatus: "Never married",
  religion: "Sikh",
  caste: "Jatt",
  gotraSelf: "Sandhu",
  education: "MBA",
  city: "Ludhiana",
  country: "India",
  phone: "9876500000",
};
