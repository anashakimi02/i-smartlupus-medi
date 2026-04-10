"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";
import { ROLE_LABELS } from "@/lib/constants";
import { formatIc } from "@/lib/utils";

export default function ProfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(data);
      setLoading(false);
    }

    loadProfile();
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-400 text-sm">Memuatkan...</div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="bg-blue-600 rounded-2xl p-3 flex items-center justify-center">
          <User className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            {profile.full_name}
          </h1>
          <p className="text-sm text-slate-500">{ROLE_LABELS[profile.role]}</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
        {/* IC Number */}
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1">
            No. Kad Pengenalan
          </p>
          <p className="text-sm font-bold text-slate-900">
            {formatIc(profile.ic_number)}
          </p>
        </div>

        {/* Unit / Jabatan */}
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1">
            Unit / Jabatan
          </p>
          <p className="text-sm font-bold text-slate-900">
            {profile.unit_name ?? "-"}
          </p>
        </div>

        {/* Peranan */}
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-1">
            Peranan
          </p>
          <p className="text-sm font-bold text-slate-900">
            {ROLE_LABELS[profile.role]}
          </p>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 rounded-2xl px-4 py-3 font-bold text-sm hover:bg-red-100 transition-colors disabled:opacity-60"
      >
        <LogOut className="w-4 h-4" />
        {loggingOut ? "Log Keluar..." : "Log Keluar"}
      </button>
    </div>
  );
}
