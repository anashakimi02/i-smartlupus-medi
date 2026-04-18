"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DisposalTicket, Profile, TicketStatus } from "@/lib/supabase/types";
import { ROLE_LABELS } from "@/lib/constants";
import { DashboardSkeleton } from "@/components/Skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { BentoCard } from "@/components/ui/bento-card";
import { Stat } from "@/components/ui/stat";
import { ClipboardList, Clock, RefreshCw, CheckCircle2, Plus } from "lucide-react";
import StatusChart from "@/components/StatusChart";
import { useTheme } from "@/components/theme-provider";
import { ListItem } from "@/components/ui/list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/StatusChip";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Inbox } from "lucide-react";
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

// Tailwind 500-level for light, 400-level for dark — consistent with emerald brand.
function chartColors(mode: "light" | "dark") {
  if (mode === "dark") {
    return {
      menunggu: "#facc15", // yellow-400
      proses:   "#fb923c", // orange-400
      selesai:  "#34d399", // emerald-400
      ditolak:  "#f87171", // red-400
    };
  }
  return {
    menunggu: "#eab308", // yellow-500
    proses:   "#f97316", // orange-500
    selesai:  "#10b981", // emerald-500 (was green-500)
    ditolak:  "#ef4444", // red-500
  };
}

// Role-aware stat labels per dashboard spec §Role variants.
// Project has 3 roles; spec's 4 roles compressed to fit data model.
function statLabels(role: Role): { total: string; pending: string; executing: string; done: string } {
  if (role === "user") {
    return {
      total: "Permohonan Saya",
      pending: "Menunggu Semakan",
      executing: "Dalam Pelaksanaan",
      done: "Selesai",
    };
  }
  // unit_aset + admin see aggregate view
  return {
    total: "Jumlah Permohonan",
    pending: "Menunggu Semakan",
    executing: "Dalam Pelaksanaan",
    done: "Selesai",
  };
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const [recent, setRecent] = useState<DisposalTicket[]>([]);
  const { resolvedTheme } = useTheme();
  const router = useRouter();

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

  const palette = chartColors(resolvedTheme);
  const chartData = [
    { name: "Menunggu", value: counts.menunggu_semakan, color: palette.menunggu },
    { name: "Proses",   value: counts.proses_pelupusan, color: palette.proses },
    { name: "Selesai",  value: counts.selesai,          color: palette.selesai },
    { name: "Ditolak",  value: counts.ditolak,          color: palette.ditolak },
  ];

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <BentoCard>
          <div className="flex items-start justify-between">
            <ClipboardList className="h-5 w-5 text-[var(--fg-muted)]" aria-hidden />
          </div>
          <div className="mt-3">
            <Stat label={statLabels(profile.role).total} value={counts.total} />
          </div>
        </BentoCard>

        <BentoCard>
          <div className="flex items-start justify-between">
            <Clock className="h-5 w-5 text-[var(--chip-pending-fg)]" aria-hidden />
          </div>
          <div className="mt-3">
            <Stat label={statLabels(profile.role).pending} value={counts.menunggu_semakan} />
          </div>
        </BentoCard>

        <BentoCard>
          <div className="flex items-start justify-between">
            <RefreshCw className="h-5 w-5 text-[var(--chip-executing-fg)]" aria-hidden />
          </div>
          <div className="mt-3">
            <Stat label={statLabels(profile.role).executing} value={counts.proses_pelupusan} />
          </div>
        </BentoCard>

        <BentoCard>
          <div className="flex items-start justify-between">
            <CheckCircle2 className="h-5 w-5 text-[var(--chip-done-fg)]" aria-hidden />
          </div>
          <div className="mt-3">
            <Stat label={statLabels(profile.role).done} value={counts.selesai} />
          </div>
        </BentoCard>

        <BentoCard span={2} className="md:col-span-4">
          <StatusChart data={chartData} />
        </BentoCard>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-subhead font-semibold text-[var(--fg)]">Terkini</h2>
          <Link
            href="/semua"
            className="text-footnote font-medium text-[var(--primary)] hover:underline"
          >
            Lihat semua →
          </Link>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-8 w-8" aria-hidden />}
            title="Belum ada permohonan"
            description={
              profile.role === "user"
                ? "Mohon pelupusan pertama anda untuk mula."
                : "Tiada tiket setakat ini."
            }
          />
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            {recent.map((t) => (
              <ListItem
                key={t.id}
                onClick={() => router.push(`/semua/${t.id}`)}
                title={
                  <span className="flex items-center gap-2">
                    <span className="text-caption font-semibold text-[var(--primary)] uppercase tracking-wide">
                      {t.ticket_no}
                    </span>
                    <StatusChip status={t.status} />
                  </span>
                }
                subtitle={
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">{t.asset_name}</span>
                    <span aria-hidden className="text-[var(--border-strong)]">·</span>
                    <span>{formatDate(t.created_at)}</span>
                  </span>
                }
              />
            ))}
          </div>
        )}
      </section>

      {profile.role === "user" && (
        <Link
          href="/mohon"
          className="fixed right-4 bottom-24 md:bottom-8 md:right-8 z-40"
          aria-label="Mohon baru"
        >
          <Button size="lg" className="shadow-lg rounded-full px-5 gap-2">
            <Plus className="h-5 w-5" aria-hidden />
            Mohon Baru
          </Button>
        </Link>
      )}
    </div>
  );
}
