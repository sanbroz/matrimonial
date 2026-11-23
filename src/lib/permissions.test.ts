import { describe, expect, it } from "vitest";
import { permissionsFor, permissionsFromForm, readPermissions } from "./permissions";

describe("staff permissions", () => {
  it("uses the defaults when nothing is saved (payments on, reports and delete off)", () => {
    expect(readPermissions(null)).toEqual({ payments: true, reports: false, delete: false });
    expect(readPermissions("junk")).toEqual({ payments: true, reports: false, delete: false });
  });

  it("keeps saved switches and ignores unknown or wrong values", () => {
    expect(readPermissions({ payments: false, reports: true, delete: "yes", other: true })).toEqual({ payments: false, reports: true, delete: false });
  });

  it("gives owners everything whatever is saved", () => {
    expect(permissionsFor("OWNER", { payments: false })).toEqual({ payments: true, reports: true, delete: true });
    expect(permissionsFor("STAFF", { payments: false })).toEqual({ payments: false, reports: false, delete: false });
  });

  it("reads the staff form checkboxes", () => {
    const fd = new Map([["perm_reports", "on"]]);
    expect(permissionsFromForm(fd)).toEqual({ payments: false, reports: true, delete: false });
  });
});
