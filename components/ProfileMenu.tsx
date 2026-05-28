"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, User as UserIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/lib/supabase/types";

interface ProfileMenuProps {
  name: string;
  role: UserRole;
  onLogOut: () => void;
}

// Map UserRole (data model) → Avatar's display role (color hint).
function avatarRole(role: UserRole): "pemohon" | "penyemak" | "pentadbir" {
  if (role === "user") return "pemohon";
  if (role === "unit_aset") return "penyemak";
  return "pentadbir";
}

export function ProfileMenu({ name, role, onLogOut }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const roleLabel = ROLE_LABELS[role];

  // Close on click-outside and Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu profil ${name}`}
        className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] hover:opacity-90 transition-opacity"
      >
        <Avatar name={name} role={avatarRole(role)} size="md" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menu profil"
          className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden animate-in"
        >
          {/* Identity block */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
            <Avatar name={name} role={avatarRole(role)} size="md" />
            <div className="min-w-0">
              <p className="text-footnote font-semibold text-[var(--fg)] truncate">
                {name}
              </p>
              <p className="text-caption text-[var(--fg-muted)] truncate">
                {roleLabel}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <Link
              href="/profil"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-footnote font-medium text-[var(--fg)] hover:bg-[var(--primary-tint)] transition-colors"
            >
              <UserIcon className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden />
              <span>Profil</span>
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogOut();
              }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-footnote font-semibold text-[var(--destructive)] hover:bg-[var(--destructive-tint)] transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              <span>Log Keluar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
