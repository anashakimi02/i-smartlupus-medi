"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { LogOut, X } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/lib/supabase/types";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type AvatarRole = "pemohon" | "penyemak" | "pentadbir";

function avatarRole(role: UserRole): AvatarRole {
  if (role === "user") return "pemohon";
  if (role === "unit_aset") return "penyemak";
  return "pentadbir";
}

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: UserRole;
  name: string;
  onLogOut: () => void;
}

export function MobileDrawer({ open, onOpenChange, role, name, onLogOut }: MobileDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm animate-fade-in md:hidden" />
        <Dialog.Content
          className="fixed top-0 left-0 bottom-0 z-50 w-72 bg-[var(--surface)] text-[var(--fg)] shadow-xl p-6 animate-slide-in-left md:hidden focus:outline-none flex flex-col gap-6"
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[var(--primary)] text-[var(--on-primary)] font-black text-xs">iS</div>
              <Dialog.Title className="text-subhead font-semibold text-[var(--primary)] tracking-tight truncate">
                i-SMARTLUPUS
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Tutup"
                className="-mr-2 p-2 rounded-md text-[var(--fg-muted)] hover:bg-[var(--primary-tint)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex items-center gap-3">
            <Avatar name={name} role={avatarRole(role)} size="lg" />
            <div className="min-w-0">
              <p className="text-body font-medium text-[var(--fg)] truncate">{name}</p>
              <Chip tone="neutral" className="mt-1">{ROLE_LABELS[role]}</Chip>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
            <span className="text-footnote text-[var(--fg-muted)]">Tema</span>
            <ThemeToggle />
          </div>

          <Button variant="secondary" onClick={onLogOut} className="w-full gap-2">
            <LogOut className="h-4 w-4" />
            Log Keluar
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
