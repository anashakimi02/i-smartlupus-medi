import { describe, it, expect } from "vitest";
import {
  blockOnDeactivate,
  DEACTIVATE_BLOCK_MESSAGE,
  blockOnDelete,
  DELETE_BLOCK_MESSAGE,
} from "./users";
import type { Profile } from "./supabase/types";

function profile(over: Partial<Profile> & Pick<Profile, "id">): Profile {
  return {
    email: `${over.id}@moh.gov.my`,
    full_name: `User ${over.id}`,
    role: "user",
    unit_name: null,
    created_at: "2026-01-01T00:00:00Z",
    is_active: true,
    ...over,
  };
}

const ADMIN_A = profile({ id: "a", role: "admin" });
const ADMIN_B = profile({ id: "b", role: "admin" });
const STAFF = profile({ id: "s", role: "unit_aset" });
const USER = profile({ id: "u", role: "user" });

describe("blockOnDeactivate", () => {
  it("allows deactivating an ordinary user", () => {
    expect(blockOnDeactivate("u", "a", [ADMIN_A, USER])).toBeNull();
  });

  it("allows deactivating asset staff", () => {
    expect(blockOnDeactivate("s", "a", [ADMIN_A, STAFF])).toBeNull();
  });

  it("refuses to deactivate your own account", () => {
    expect(blockOnDeactivate("a", "a", [ADMIN_A, ADMIN_B])).toBe("self");
  });

  it("refuses self-deactivation even for a non-admin", () => {
    expect(blockOnDeactivate("u", "u", [ADMIN_A, USER])).toBe("self");
  });

  it("refuses to deactivate the last active admin", () => {
    expect(blockOnDeactivate("a", "b", [ADMIN_A, USER])).toBe("last_admin");
  });

  it("allows deactivating an admin while another active admin remains", () => {
    expect(blockOnDeactivate("a", "b", [ADMIN_A, ADMIN_B])).toBeNull();
  });

  it("does not count an ALREADY INACTIVE admin as cover", () => {
    // b is an admin but suspended — deactivating a would leave zero active admins.
    const suspendedAdmin = profile({ id: "b", role: "admin", is_active: false });
    expect(blockOnDeactivate("a", "c", [ADMIN_A, suspendedAdmin])).toBe("last_admin");
  });

  it("reports self before last_admin when both apply", () => {
    expect(blockOnDeactivate("a", "a", [ADMIN_A, USER])).toBe("self");
  });

  it("returns null when the target is not in the list at all", () => {
    // Nothing to deactivate; the caller's update will no-op or 404 on its own.
    expect(blockOnDeactivate("zzz", "a", [ADMIN_A, USER])).toBeNull();
  });

  it("is unaffected by inactive non-admin users in the list", () => {
    const inactiveUser = profile({ id: "x", is_active: false });
    expect(blockOnDeactivate("a", "b", [ADMIN_A, ADMIN_B, inactiveUser])).toBeNull();
  });
});

describe("blockOnDelete", () => {
  it("allows deleting an ordinary user", () => {
    expect(blockOnDelete("u", "a", [ADMIN_A, USER])).toBeNull();
  });

  it("allows deleting asset staff", () => {
    expect(blockOnDelete("s", "a", [ADMIN_A, STAFF])).toBeNull();
  });

  it("refuses self-deletion", () => {
    expect(blockOnDelete("a", "a", [ADMIN_A, ADMIN_B])).toBe("self");
  });

  it("refuses self-deletion even for a non-admin", () => {
    expect(blockOnDelete("u", "u", [ADMIN_A, USER])).toBe("self");
  });

  it("refuses deleting the last active admin", () => {
    expect(blockOnDelete("a", "b", [ADMIN_A, USER])).toBe("last_admin");
  });

  it("allows deleting an admin while another active admin remains", () => {
    expect(blockOnDelete("a", "b", [ADMIN_A, ADMIN_B])).toBeNull();
  });

  it("does not count an ALREADY INACTIVE admin as cover", () => {
    const suspendedAdmin = profile({ id: "b", role: "admin", is_active: false });
    expect(blockOnDelete("a", "c", [ADMIN_A, suspendedAdmin])).toBe("last_admin");
  });

  it("allows deleting an already-inactive admin when an active one remains", () => {
    // Deleting a suspended admin removes nobody from the active roster.
    const suspendedAdmin = profile({ id: "c", role: "admin", is_active: false });
    expect(blockOnDelete("c", "a", [ADMIN_A, suspendedAdmin])).toBeNull();
  });

  it("reports self before last_admin when both apply", () => {
    expect(blockOnDelete("a", "a", [ADMIN_A, USER])).toBe("self");
  });

  it("returns null when the target is not in the list at all", () => {
    expect(blockOnDelete("zzz", "a", [ADMIN_A, USER])).toBeNull();
  });
});

describe("DELETE_BLOCK_MESSAGE", () => {
  it("has a Malay message for each block reason", () => {
    expect(DELETE_BLOCK_MESSAGE.self).toBe("Anda tidak boleh memadam akaun sendiri.");
    expect(DELETE_BLOCK_MESSAGE.last_admin).toBe(
      "Sekurang-kurangnya seorang pentadbir aktif diperlukan.",
    );
  });

  it("says memadam, not menyahaktifkan — both are shown to admins", () => {
    // The meN- prefix assimilates the p, so the root "padam" surfaces as
    // "memadam" — match that, not the bare root.
    expect(DELETE_BLOCK_MESSAGE.self).not.toBe(DEACTIVATE_BLOCK_MESSAGE.self);
    expect(DELETE_BLOCK_MESSAGE.self).toMatch(/memadam/i);
    expect(DEACTIVATE_BLOCK_MESSAGE.self).toMatch(/menyahaktifkan/i);
  });
});

describe("DEACTIVATE_BLOCK_MESSAGE", () => {
  it("has a Malay message for each block reason", () => {
    expect(DEACTIVATE_BLOCK_MESSAGE.self).toBe(
      "Anda tidak boleh menyahaktifkan akaun sendiri.",
    );
    expect(DEACTIVATE_BLOCK_MESSAGE.last_admin).toBe(
      "Sekurang-kurangnya seorang pentadbir aktif diperlukan.",
    );
  });
});
