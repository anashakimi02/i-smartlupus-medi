import type { Profile } from "./supabase/types";

export type DeactivateBlock = "self" | "last_admin";

export const DEACTIVATE_BLOCK_MESSAGE: Record<DeactivateBlock, string> = {
  self: "Anda tidak boleh menyahaktifkan akaun sendiri.",
  last_admin: "Sekurang-kurangnya seorang pentadbir aktif diperlukan.",
};

/**
 * Why this deactivation must be refused, or null if it is allowed.
 *
 * Call only when turning a user OFF — reactivating is always safe.
 * Used by the form for instant feedback AND by the API against fresh
 * rows, because the browser's copy of the list can be minutes stale.
 */
export function blockOnDeactivate(
  targetId: string,
  currentUserId: string,
  profiles: Profile[],
): DeactivateBlock | null {
  if (targetId === currentUserId) return "self";

  const target = profiles.find((p) => p.id === targetId);
  if (!target) return null;

  if (target.role === "admin" && target.is_active) {
    // An already-inactive admin is not cover for the one being removed.
    const otherActiveAdmins = profiles.filter(
      (p) => p.id !== targetId && p.role === "admin" && p.is_active,
    );
    if (otherActiveAdmins.length === 0) return "last_admin";
  }

  return null;
}

export type DeleteBlock = "self" | "last_admin";

export const DELETE_BLOCK_MESSAGE: Record<DeleteBlock, string> = {
  self: "Anda tidak boleh memadam akaun sendiri.",
  last_admin: "Sekurang-kurangnya seorang pentadbir aktif diperlukan.",
};

/**
 * Why this deletion must be refused, or null if it is allowed.
 *
 * The rules match blockOnDeactivate — deleting is strictly more destructive
 * than deactivating, so anything that blocks the lesser action blocks this
 * one. Kept as its own function rather than an alias because the messages
 * differ ("padam" vs "nyahaktif") and both are shown to admins.
 *
 * Used by the form for instant feedback AND by the API against fresh rows,
 * because the browser's copy of the list can be minutes stale.
 */
export function blockOnDelete(
  targetId: string,
  currentUserId: string,
  profiles: Profile[],
): DeleteBlock | null {
  if (targetId === currentUserId) return "self";

  const target = profiles.find((p) => p.id === targetId);
  if (!target) return null;

  if (target.role === "admin" && target.is_active) {
    // An already-inactive admin is not cover for the one being removed.
    const otherActiveAdmins = profiles.filter(
      (p) => p.id !== targetId && p.role === "admin" && p.is_active,
    );
    if (otherActiveAdmins.length === 0) return "last_admin";
  }

  return null;
}
