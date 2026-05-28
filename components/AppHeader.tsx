"use client";

import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ProfileMenu } from "@/components/ProfileMenu";
import type { UserRole } from "@/lib/supabase/types";

interface AppHeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenDrawer: () => void;
  name: string;
  role: UserRole;
  onLogOut: () => void;
}

export function AppHeader({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenDrawer,
  name,
  role,
  onLogOut,
}: AppHeaderProps) {
  const ChevronIcon = sidebarCollapsed ? ChevronRight : ChevronLeft;
  const chevronLabel = sidebarCollapsed ? "Kembangkan bar sisi" : "Runtuhkan bar sisi";

  return (
    <header className="fixed top-0 inset-x-0 z-40 flex items-center gap-3 h-16 px-4 bg-[var(--surface)]/95 backdrop-blur border-b border-[var(--border)]">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={chevronLabel}
        className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-md text-[var(--fg-muted)] hover:bg-[var(--primary-tint)] hover:text-[var(--fg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
      >
        <ChevronIcon className="h-4 w-4" aria-hidden />
      </button>

      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Buka menu"
        className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md text-[var(--fg-muted)] hover:bg-[var(--primary-tint)] hover:text-[var(--fg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
      >
        <Menu className="h-4 w-4" aria-hidden />
      </button>

      <div className="flex items-center gap-3 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Jata_MalaysiaV2.svg"
          alt="Jata Negara Malaysia"
          className="h-12 w-auto shrink-0"
        />
        <div className="flex flex-col justify-center min-w-0 leading-tight">
          <span className="text-[13px] font-semibold text-[var(--fg)] tracking-tight truncate">
            i-SMARTLUPUS
          </span>
          <span className="text-[10px] text-[var(--fg)] truncate">
            Hospital Besut
          </span>
          <span className="text-[10px] text-[var(--fg)] truncate">
            Terengganu
          </span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <ProfileMenu name={name} role={role} onLogOut={onLogOut} />
      </div>
    </header>
  );
}
