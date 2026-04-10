"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, TicketStatus } from "@/lib/supabase/types";
import StatCard from "@/components/StatCard";
import { ClipboardList, Clock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

const roleTitle: Record<Profile["role"], string> = {
  admin: "Papan Pemuka Pentadbir",
  unit_aset: "Papan Pemuka Unit Aset",
  user: "Papan Pemuka Saya",
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState({ total: 0, menunggu_semakan: 0, proses_pelupusan: 0, selesai: 0, ditolak: 0 });

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

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">
          {roleTitle[profile.role]}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Selamat datang, {profile.full_name}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Jumlah" value={counts.total} icon={<ClipboardList size={22} />} color="blue" />
        <StatCard label="Menunggu" value={counts.menunggu_semakan} icon={<Clock size={22} />} color="yellow" />
        <StatCard label="Proses" value={counts.proses_pelupusan} icon={<AlertTriangle size={22} />} color="orange" />
        <StatCard label="Selesai" value={counts.selesai} icon={<CheckCircle size={22} />} color="green" />
      </div>

      {counts.ditolak > 0 && (
        <div className="max-w-xs">
          <StatCard label="Ditolak" value={counts.ditolak} icon={<XCircle size={22} />} color="red" />
        </div>
      )}
    </div>
  );
}
