"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DisposalTicket, Profile, TicketStatus } from "@/lib/supabase/types";
import { ROLE_LABELS } from "@/lib/constants";
import { DashboardSkeleton } from "@/components/Skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { getGreeting } from "@/lib/greeting";

type Role = Profile["role"];

function avatarRole(role: Role): "pemohon" | "penyemak" | "pentadbir" {
  if (role === "user") return "pemohon";
  if (role === "unit_aset") return "penyemak";
  return "pentadbir";
}

function formatTodayMY(d: Date = new Date()): string {
  // 18 Apr 2026 style — Intl with ms-MY locale
  return new Intl.DateTimeFormat("ms-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

interface Counts {
  total: number;
  menunggu_semakan: number;
  proses_pelupusan: number;
  selesai: number;
  ditolak: number;
}

const emptyCounts: Counts = {
  total: 0,
  menunggu_semakan: 0,
  proses_pelupusan: 0,
  selesai: 0,
  ditolak: 0,
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const [recent, setRecent] = useState<DisposalTicket[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!prof) return;
      setProfile(prof as Profile);

      // Counts
      const statusQuery = supabase.from("disposal_tickets").select("status");
      const { data: statusRows } = prof.role === "user"
        ? await statusQuery.eq("created_by", user.id)
        : await statusQuery;

      const rows = statusRows ?? [];
      const count = (s: TicketStatus) => rows.filter((t) => t.status === s).length;
      setCounts({
        total: rows.length,
        menunggu_semakan: count("menunggu_semakan"),
        proses_pelupusan: count("proses_pelupusan"),
        selesai: count("selesai"),
        ditolak: count("ditolak"),
      });

      // Recent tickets — last 5
      const recentQuery = supabase
        .from("disposal_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      const { data: recentRows } = prof.role === "user"
        ? await recentQuery.eq("created_by", user.id)
        : await recentQuery;
      setRecent((recentRows ?? []) as DisposalTicket[]);
    }
    load();
  }, []);

  if (!profile) {
    return (
      <div role="status">
        <DashboardSkeleton />
        <span className="sr-only">Memuatkan papan pemuka...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting strip — flush, not a card */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-title-1 font-semibold text-[var(--fg)] tracking-tight">
            {getGreeting()}, {profile.full_name.split(" ")[0]}
          </h1>
          <div className="mt-1.5 flex items-center gap-2 text-footnote text-[var(--fg-muted)]">
            <span>{formatTodayMY()}</span>
            <span aria-hidden>·</span>
            <Chip tone="neutral">{ROLE_LABELS[profile.role]}</Chip>
          </div>
        </div>
        <Avatar name={profile.full_name} role={avatarRole(profile.role)} size="lg" />
      </header>

      {/* Bento grid + recent tickets land in Tasks 7, 8, 9 */}
      <div data-testid="dashboard-body" />

      {/* Floating CTA lands in Task 10 */}
    </div>
  );
}
