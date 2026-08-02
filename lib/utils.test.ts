import { describe, it, expect } from "vitest";
import { isValidEmail, isMohEmail, MOH_DOMAIN } from "./utils";

describe("isValidEmail", () => {
  it("accepts normal addresses", () => {
    expect(isValidEmail("nama@hospital.gov.my")).toBe(true);
    expect(isValidEmail("a.b-c@sub.domain.co")).toBe(true);
  });

  it("trims surrounding whitespace before checking", () => {
    expect(isValidEmail("  user@example.com  ")).toBe(true);
  });

  it("rejects obvious non-emails", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("plainstring")).toBe(false);
    expect(isValidEmail("no@domain")).toBe(false); // no dot in domain
    expect(isValidEmail("@nolocal.com")).toBe(false);
    expect(isValidEmail("two@@at.com")).toBe(false);
    expect(isValidEmail("has space@x.com")).toBe(false);
  });
});

describe("isMohEmail", () => {
  it("accepts an address on the MOH domain", () => {
    expect(isMohEmail("ahmad@moh.gov.my")).toBe(true);
  });

  it("is case-insensitive and trims surrounding whitespace", () => {
    expect(isMohEmail("  Ahmad@MOH.GOV.MY  ")).toBe(true);
  });

  it("rejects a domain that merely ENDS WITH the MOH domain", () => {
    // The trap: endsWith("moh.gov.my") would wrongly accept both of these.
    expect(isMohEmail("attacker@notmoh.gov.my")).toBe(false);
    expect(isMohEmail("attacker@evil-moh.gov.my")).toBe(false);
  });

  it("rejects a subdomain of the MOH domain", () => {
    expect(isMohEmail("ahmad@hkl.moh.gov.my")).toBe(false);
  });

  it("rejects other government and public domains", () => {
    expect(isMohEmail("ahmad@hospital.gov.my")).toBe(false);
    expect(isMohEmail("ahmad@gov.my")).toBe(false);
    expect(isMohEmail("admin@example.com")).toBe(false);
    expect(isMohEmail("ahmad@gmail.com")).toBe(false);
  });

  it("rejects anything that is not a valid email in the first place", () => {
    expect(isMohEmail("")).toBe(false);
    expect(isMohEmail("moh.gov.my")).toBe(false);
    expect(isMohEmail("@moh.gov.my")).toBe(false);
    expect(isMohEmail("two@@moh.gov.my")).toBe(false);
  });

  it("exposes the domain as a constant so the UI and API cannot drift", () => {
    expect(MOH_DOMAIN).toBe("moh.gov.my");
  });
});
