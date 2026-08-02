import { describe, it, expect } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  checkPassword,
  isValidPassword,
  PASSWORD_ERROR,
} from "./password";

// A password that satisfies all five rules, used as the base for mutations below.
const VALID = "Hospital#2026x";

describe("checkPassword", () => {
  it("returns the five rules in display order", () => {
    expect(checkPassword("").map((r) => r.id)).toEqual([
      "panjang",
      "besar",
      "kecil",
      "nombor",
      "simbol",
    ]);
  });

  it("labels read exactly as designed, in Malay", () => {
    expect(checkPassword("").map((r) => r.label)).toEqual([
      "12 aksara atau lebih",
      "Satu huruf besar (A-Z)",
      "Satu huruf kecil (a-z)",
      "Satu nombor (0-9)",
      "Satu simbol (!@#$...)",
    ]);
  });

  it("marks nothing met for an empty password", () => {
    expect(checkPassword("").every((r) => !r.met)).toBe(true);
  });

  it("marks everything met for a compliant password", () => {
    expect(checkPassword(VALID).every((r) => r.met)).toBe(true);
  });

  it("evaluates each rule independently of the others", () => {
    const met = (pw: string, id: string) =>
      checkPassword(pw).find((r) => r.id === id)!.met;

    expect(met("abc", "panjang")).toBe(false);
    expect(met("aaaaaaaaaaaa", "panjang")).toBe(true); // exactly 12

    expect(met("abc", "besar")).toBe(false);
    expect(met("aBc", "besar")).toBe(true);

    expect(met("ABC", "kecil")).toBe(false);
    expect(met("ABc", "kecil")).toBe(true);

    expect(met("abc", "nombor")).toBe(false);
    expect(met("ab3", "nombor")).toBe(true);

    expect(met("abc", "simbol")).toBe(false);
    expect(met("ab#", "simbol")).toBe(true);
  });

  it("does not count whitespace as a symbol", () => {
    const met = checkPassword("Ada Password12").find((r) => r.id === "simbol")!.met;
    expect(met).toBe(false);
  });
});

describe("isValidPassword", () => {
  it("accepts a password meeting all five rules", () => {
    expect(isValidPassword(VALID)).toBe(true);
  });

  it("rejects a password failing exactly one rule", () => {
    expect(isValidPassword("Hospital#20x")).toBe(true); // 12 chars, control
    expect(isValidPassword("Hospital#2x")).toBe(false); // 11 chars — too short
    expect(isValidPassword("hospital#2026x")).toBe(false); // no uppercase
    expect(isValidPassword("HOSPITAL#2026X")).toBe(false); // no lowercase
    expect(isValidPassword("Hospital#abcxy")).toBe(false); // no digit
    expect(isValidPassword("Hospital22026x")).toBe(false); // no symbol
  });

  it("rejects the empty password", () => {
    expect(isValidPassword("")).toBe(false);
  });

  it("agrees with checkPassword", () => {
    for (const pw of ["", "abc", VALID, "hospital#2026x"]) {
      expect(isValidPassword(pw)).toBe(checkPassword(pw).every((r) => r.met));
    }
  });
});

describe("constants", () => {
  it("requires 12 characters", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
  });

  it("exposes one shared Malay error message for the server to return", () => {
    expect(PASSWORD_ERROR).toBe(
      "Kata laluan mesti 12 aksara dengan huruf besar, huruf kecil, nombor dan simbol.",
    );
  });
});
