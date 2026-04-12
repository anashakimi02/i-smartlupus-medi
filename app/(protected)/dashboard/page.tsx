"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, TicketStatus } from "@/lib/supabase/types";
import StatCard from "@/components/StatCard";
import StatusChart from "@/components/StatusChart";
import { DashboardSkeleton } from "@/components/Skeleton";
import { ClipboardList, Clock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

const roleTitle: Record<Profile["role"], string> = {
  admin: "Papan Pemuka Pentadbir",
  unit_aset: "Papan Pemuka Unit Aset",
  user: "Papan Pemuka Saya",
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState({ total: 0, menunggu_semakan: 0, proses_pelupusan: 0, selesai: 0, ditolak: 0 });

  const chartData = [
    { name: "Menunggu", value: counts.menunggu_semakan, color: "#eab308" },
    { name: "Proses", value: counts.proses_pelupusan, color: "#f97316" },
    { name: "Selesai", value: counts.selesai, color: "#22c55e" },
    { name: "Ditolak", value: counts.ditolak, color: "#ef4444" },
  ];

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

      const query = supabase.from("disposal_tickets").select("status");
      const { data: tickets } = prof.role === "user"
        ? await query.eq("created_by", user.id)
        : await query;

      const rows = tickets ?? [];
      const count = (s: TicketStatus) => rows.filter((t) => t.status === s).length;
      setCounts({
        total: rows.length,
        menunggu_semakan: count("menunggu_semakan"),
        proses_pelupusan: count("proses_pelupusan"),
        selesai: count("selesai"),
        ditolak: count("ditolak"),
      });
    }
    load();
  }, []);

  if (!profile) return <div role="status"><DashboardSkeleton /><span className="sr-only">Memuatkan papan pemuka...</span></div>;

  return (
    <div>
      {/* Header — generous spacing below for hierarchy */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900">
          {roleTitle[profile.role]}
        </h1>
        <p className="text-sm text-slate-500 mt-1.5">
          Selamat datang, {profile.full_name}
        </p>
      </div>

      <StatusChart data={chartData} />

      {/* Stat cards — tighter gap between related items */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Jumlah" value={counts.total} icon={<ClipboardList size={20} />} color="blue" />
        <StatCard label="Menunggu" value={counts.menunggu_semakan} icon={<Clock size={20} />} color="yellow" />
        <StatCard label="Proses" value={counts.proses_pelupusan} icon={<AlertTriangle size={20} />} color="orange" />
        <StatCard label="Selesai" value={counts.selesai} icon={<CheckCircle size={20} />} color="green" />
      </div>

      {/* Ditolak — separated with larger gap since it's conditional/secondary */}
      {counts.ditolak > 0 && (
        <div className="mt-4 max-w-xs">
          <StatCard label="Ditolak" value={counts.ditolak} icon={<XCircle size={20} />} color="red" />
        </div>
      )}
    </div>
  );
}
