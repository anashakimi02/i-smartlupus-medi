"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, Shield, Building, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/supabase/types";
import { ROLE_LABELS } from "@/lib/constants";
import { isMohEmail, MOH_DOMAIN, cn } from "@/lib/utils";
import { isValidPassword, PASSWORD_ERROR, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordChecklist } from "@/components/ui/password-checklist";
import { ListItem } from "@/components/ui/list-item";
import { Avatar } from "@/components/ui/avatar";
import SkeletonPulse from "@/components/Skeleton";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "user", label: "Pengguna" },
  { value: "unit_aset", label: "Unit Aset" },
  { value: "admin", label: "Pentadbir" },
];

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonPulse className="h-8 w-48" />
          <SkeletonPulse className="h-4 w-32" />
        </div>
        <SkeletonPulse className="h-10 w-32 rounded-md" />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-4 py-4 border-b border-[var(--border)] last:border-0 flex items-center gap-3">
            <SkeletonPulse className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonPulse className="h-4 w-48" />
              <SkeletonPulse className="h-3 w-32" />
            </div>
            <SkeletonPulse className="h-6 w-20 rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PenggunaPage() {
  const supabase = createClient();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
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
    setEmail("");
    setFullName("");
    setRole("user");
    setUnitName("");
    setPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!isMohEmail(cleanEmail)) {
      toast.error(`Hanya alamat e-mel @${MOH_DOMAIN} dibenarkan.`);
      return;
    }
    if (!fullName.trim()) {
      toast.error("Nama penuh diperlukan.");
      return;
    }
    if (!isValidPassword(password)) {
      toast.error(PASSWORD_ERROR);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          full_name: fullName.trim(),
          role,
          unit_name: unitName.trim() || null,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Pendaftaran gagal. Cuba semula.");
        return;
      }

      toast.success(`${fullName.trim()} berjaya didaftarkan!`);
      resetForm();
      setShowForm(false);
      await loadProfiles();
    } catch {
      toast.error("Ralat tidak dijangka. Sila cuba semula.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-title-1 font-semibold text-[var(--fg)] tracking-tight flex items-center gap-2">
            <Users size={24} className="text-[var(--primary)]" />
            Pengurusan Pengguna
          </h1>
          <p className="text-footnote text-[var(--fg-muted)] mt-1">
            {profiles.length} pengguna berdaftar dalam sistem
          </p>
        </div>
        <Button
          onClick={() => setShowForm((prev) => !prev)}
          variant={showForm ? "ghost" : "primary"}
          className={showForm ? "shrink-0 h-12 w-12 p-0 text-[var(--fg)]" : "shrink-0 gap-2"}
          aria-label={showForm ? "Tutup borang" : undefined}
        >
          {showForm ? (
            <X size={32} strokeWidth={2.5} />
          ) : (
            <>
              <UserPlus size={16} />
              Daftar Baru
            </>
          )}
        </Button>
      </header>

      {/* Registration Form */}
      {showForm && (
        <div className="bg-[var(--surface)] rounded-xl p-5 md:p-6 border border-[var(--border)] shadow-none animate-in">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus size={18} className="text-[var(--primary)]" />
            <h2 className="text-subhead font-semibold text-[var(--fg)] uppercase tracking-wider">
              Pendaftaran Pengguna Baharu
            </h2>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Email */}
              <Input
                label="E-mel"
                required
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`email@${MOH_DOMAIN}`}
                trailing={<Mail size={16} className="text-[var(--fg-muted)]" />}
                helper={`Hanya alamat @${MOH_DOMAIN} dibenarkan.`}
              />

              {/* Full Name */}
              <Input
                label="Nama Penuh"
                required
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="cth. Ahmad bin Ali"
              />

              {/* Role Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-subhead font-medium text-[var(--fg)]">
                  Peranan <span className="text-[var(--destructive)] ml-0.5">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLE_OPTIONS.map((opt) => {
                    const isActive = role === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRole(opt.value)}
                        className={cn(
                          "h-11 rounded-md border text-caption font-semibold transition-all active:scale-95 uppercase tracking-wide",
                          isActive
                            ? "bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] shadow-sm"
                            : "bg-[var(--bg)] text-[var(--fg-muted)] border-[var(--border)] hover:border-[var(--border-strong)]"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Unit / Jabatan */}
              <Input
                label="Unit / Jabatan"
                type="text"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="cth. Unit Aset Tetap"
                trailing={<Building size={16} className="text-[var(--fg-muted)]" />}
              />

              {/* Password */}
              <div>
                <Input
                  label="Kata Laluan"
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kata laluan sementara"
                  minLength={PASSWORD_MIN_LENGTH}
                  trailing={<Shield size={16} className="text-[var(--fg-muted)]" />}
                />
                <PasswordChecklist password={password} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
              <Button
                type="submit"
                loading={submitting}
                className="flex-1"
              >
                Daftar Pengguna
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Batal
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* User List */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-none divide-y divide-[var(--border)]">
        {profiles.length === 0 ? (
          <div className="py-20 text-center text-[var(--fg-muted)]">
            <Users className="h-10 w-10 mx-auto opacity-10 mb-2" />
            <p className="text-subhead font-medium">Tiada pengguna berdaftar.</p>
          </div>
        ) : (
          profiles.map((p) => (
            <ListItem
              key={p.id}
              leading={
                <Avatar 
                  name={p.full_name} 
                  role={p.role === "user" ? "pemohon" : p.role === "unit_aset" ? "penyemak" : "pentadbir"} 
                />
              }
              title={
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--fg)]">{p.full_name}</span>
                </div>
              }
              subtitle={
                <div className="flex items-center gap-1.5">
                  <span className="truncate">{p.email}</span>
                  {p.unit_name && (
                    <>
                      <span aria-hidden className="text-[var(--border-strong)]">·</span>
                      <span className="truncate">{p.unit_name}</span>
                    </>
                  )}
                </div>
              }
              trailing={
                <span className="bg-[var(--primary-tint)] text-[var(--primary)] text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border border-[var(--primary)] border-opacity-20">
                  {ROLE_LABELS[p.role]}
                </span>
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
