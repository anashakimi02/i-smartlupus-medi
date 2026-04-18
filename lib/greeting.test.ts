import { describe, it, expect } from "vitest";
import { getGreeting } from "./greeting";

describe("getGreeting", () => {
  it("returns 'Selamat pagi' before 12:00", () => {
    expect(getGreeting(new Date(2026, 3, 18, 5, 0))).toBe("Selamat pagi");
    expect(getGreeting(new Date(2026, 3, 18, 11, 59))).toBe("Selamat pagi");
  });

  it("returns 'Selamat tengah hari' between 12:00 and 14:59", () => {
    expect(getGreeting(new Date(2026, 3, 18, 12, 0))).toBe("Selamat tengah hari");
    expect(getGreeting(new Date(2026, 3, 18, 14, 59))).toBe("Selamat tengah hari");
  });

  it("returns 'Selamat petang' between 15:00 and 18:59", () => {
    expect(getGreeting(new Date(2026, 3, 18, 15, 0))).toBe("Selamat petang");
    expect(getGreeting(new Date(2026, 3, 18, 18, 59))).toBe("Selamat petang");
  });

  it("returns 'Selamat malam' from 19:00 onwards and before 5:00", () => {
    expect(getGreeting(new Date(2026, 3, 18, 19, 0))).toBe("Selamat malam");
    expect(getGreeting(new Date(2026, 3, 18, 23, 59))).toBe("Selamat malam");
    expect(getGreeting(new Date(2026, 3, 18, 0, 0))).toBe("Selamat malam");
    expect(getGreeting(new Date(2026, 3, 18, 4, 59))).toBe("Selamat malam");
  });

  it("defaults to current time when no arg provided", () => {
    const result = getGreeting();
    expect([
      "Selamat pagi",
      "Selamat tengah hari",
      "Selamat petang",
      "Selamat malam",
    ]).toContain(result);
  });
});
