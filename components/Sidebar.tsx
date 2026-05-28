"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Plus,
  ClipboardList,
  User,
  ClipboardCheck,
  List,
  Users,
  FilePlus,
  LayoutList,
  type LucideIcon,
} from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";
import type { UserRole } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Plus,
  ClipboardList,
  User,
  ClipboardCheck,
  List,
  Users,
  FilePlus,
  LayoutList,
};

interface SidebarProps {
  role: UserRole;
  collapsed: boolean;
}

export default function Sidebar({ role, collapsed }: SidebarProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS[role];

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col md:fixed md:top-16 md:bottom-0 z-30",
        "bg-[var(--surface)] border-r border-[var(--border)] text-[var(--fg)]",
        "transition-[width] duration-base ease-ios-out",
        collapsed ? "md:w-16" : "md:w-60",
      )}
    >
      {/* Navigation */}
      <nav aria-label="Menu utama" className={cn("flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")}>
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = ICON_MAP[item.icon] ?? Home;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center rounded-md text-subhead font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                    collapsed
                      ? "justify-center w-11 h-11 mx-auto"
                      : "gap-3 px-3 py-2.5",
                    isActive
                      ? "bg-[var(--primary-tint)] text-[var(--primary)]"
                      : "text-[var(--fg-muted)] hover:bg-[var(--primary-tint)] hover:text-[var(--fg)]",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

    </aside>
  );
}
