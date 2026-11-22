import { describe, expect, it } from "vitest";
import { classifyHost, schemaForSlug, slugError } from "./host";

describe("classifyHost", () => {
  const C = (h: string) => classifyHost(h, "sanbroz.com", "bureau");
  it("recognises the console, bureaus and custom domains", () => {
    expect(C("bureau.sanbroz.com")).toEqual({ kind: "console" });
    expect(C("Matrimonial.SANBROZ.com.")).toEqual({ kind: "subdomain", slug: "matrimonial" });
    expect(C("crm.sharmabureau.in")).toEqual({ kind: "custom", host: "crm.sharmabureau.in" });
  });
  it("rejects the bare domain, nested subdomains and junk", () => {
    expect(C("sanbroz.com").kind).toBe("invalid");
    expect(C("a.b.sanbroz.com").kind).toBe("invalid");
    expect(C("").kind).toBe("invalid");
    expect(C("evil host").kind).toBe("invalid");
  });
  it("works with a port in development", () => {
    expect(classifyHost("a.localhost:3000", "localhost:3000", "bureau")).toEqual({ kind: "subdomain", slug: "a" });
    expect(classifyHost("bureau.localhost:3000", "localhost:3000", "bureau")).toEqual({ kind: "console" });
    expect(classifyHost("a.localhost:8080", "localhost:3000", "bureau").kind).toBe("custom");
  });
});

describe("slugs", () => {
  const reserved = new Set(["bureau", "www"]);
  it("validates", () => {
    expect(slugError("sharma", reserved)).toBeNull();
    expect(slugError("sharma-bureau2", reserved)).toBeNull();
    expect(slugError("bureau", reserved)).toMatch(/reserved/);
    expect(slugError("Sharma", reserved)).not.toBeNull();
    expect(slugError("1abc", reserved)).not.toBeNull();
    expect(slugError("a", reserved)).not.toBeNull();
    expect(slugError("ab-", reserved)).not.toBeNull();
    expect(slugError("a--b", reserved)).not.toBeNull();
  });
  it("maps to a schema name", () => {
    expect(schemaForSlug("sharma-bureau")).toBe("t_sharma_bureau");
  });
});
