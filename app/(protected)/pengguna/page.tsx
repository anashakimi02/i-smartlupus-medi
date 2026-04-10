"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/supabase/types";
import { ROLE_LABELS } from "@/lib/constants";
import { icToEmail, validateIc, formatIc } from "@/lib/utils";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "user", label: "Pengguna" },
  { value: "unit_aset", label: "Unit Aset" },
  { value: "admin", label: "Pentadbir" },
];

export default function PenggunaPage() {
  const supabase = createClient();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [icNumber, setIcNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [unitName, setUnitName] = useState("");
  const [password, setPassword] = useState("");

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProfiles(data as Profile[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setIcNumber("");
    setFullName("");
    setRole("user");
    setUnitName("");
    setPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const cleanIc = icNumber.replace(/\D/g, "");

    if (!validateIc(cleanIc)) {
      toast.error("No. Kad Pengenalan mesti 12 digit angka.");
      return;
    }
    if (!fullName.trim()) {
      toast.error("Nama penuh diperlukan.");
      return;
    }
    if (password.length < 6) {
      toast.error("Kata laluan mesti sekurang-kurangnya 6 aksara.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: icToEmail(cleanIc),
          password,
        });

      if (signUpError) {
        toast.error(signUpError.message);
        return;
      }

      if (signUpData.user) {
        const { error: profileError } = await supabase.from("profiles").insert({
          id: signUpData.user.id,
          ic_number: cleanIc,
          full_name: fullName.trim(),
          role,
          unit_name: unitName.trim() || null,
        });

        if (profileError) {
          toast.error(`Ralat profil: ${profileError.message}`);
          return;
        }

        toast.success(`${fullName.trim()} berjaya didaftarkan!`);
        resetForm();
        setShowForm(false);
        await loadProfiles();
      } else {
        toast.error("Pendaftaran gagal. Cuba semula.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Users size={24} />
            Pengurusan Pengguna
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? "Memuatkan..." : `${profiles.length} pengguna berdaftar`}
          </p>
        </div>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <UserPlus size={16} />
          Daftar Baru
        </button>
      </div>

      {/* Registration Form */}
      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-base font-bold text-slate-800 mb-4">
            Pendaftaran Pengguna Baharu
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* IC Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                No. Kad Pengenalan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={12}
                value={icNumber}
                onChange={(e) =>
                  setIcNumber(e.target.value.replace(/\D/g, "").slice(0, 12))
                }
                placeholder="cth. 901231071234"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nama Penuh <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="cth. Ahmad bin Ali"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Peranan <span className="text-red-500">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit / Jabatan */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Unit / Jabatan
              </label>
              <input
                type="text"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="cth. Unit Aset Tetap"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Kata Laluan <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 aksara"
                minLength={6}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
              >
                {submitting ? "Mendaftar..." : "Daftar Pengguna"}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl transition-colors"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User List */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">
            Memuatkan senarai pengguna...
          </p>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            Tiada pengguna berdaftar.
          </p>
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {profile.full_name}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatIc(profile.ic_number)}
                  {profile.unit_name ? ` · ${profile.unit_name}` : ""}
                </p>
              </div>
              <span className="shrink-0 bg-blue-50 text-blue-600 text-xs font-semibold uppercase px-3 py-1 rounded-full">
                {ROLE_LABELS[profile.role]}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
