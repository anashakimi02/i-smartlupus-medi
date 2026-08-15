"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, Building, Mail, X, Eye, EyeOff, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/supabase/types";
import { ROLE_LABELS } from "@/lib/constants";
import { isMohEmail, MOH_DOMAIN, cn } from "@/lib/utils";
import { isValidPassword, PASSWORD_ERROR, PASSWORD_MIN_LENGTH } from "@/lib/password";
import {
  blockOnDeactivate,
  DEACTIVATE_BLOCK_MESSAGE,
  blockOnDelete,
  DELETE_BLOCK_MESSAGE,
} from "@/lib/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PasswordChecklist } from "@/components/ui/password-checklist";
import { ListItem } from "@/components/ui/list-item";
import { Avatar } from "@/components/ui/avatar";
import SkeletonPulse from "@/components/Skeleton";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "user", label: "Pengguna" },
  { value: "unit_aset", label: "Unit Aset" },
  { value: "admin", label: "Pentadbir" },
];

const STATUS_OPTIONS: { value: boolean; label: string; hint: string }[] = [
  { value: true, label: "Aktif", hint: "Pengguna boleh log masuk." },
  { value: false, label: "Tidak Aktif", hint: "Log masuk disekat serta-merta." },
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
  const [showPassword, setShowPassword] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // null = creating a new user, an id = editing that user.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    // Needed for the "cannot deactivate yourself" guard.
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEmail("");
    setFullName("");
    setRole("user");
    setUnitName("");
    setPassword("");
    setShowPassword(false);
    setIsActive(true);
    setEditingId(null);
    setConfirmingDelete(false);
    setDeleting(false);
  }

  function closeForm() {
    resetForm();
    setShowForm(false);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(p: Profile) {
    setEditingId(p.id);
    setEmail(p.email);
    setFullName(p.full_name);
    setRole(p.role);
    setUnitName(p.unit_name ?? "");
    setIsActive(p.is_active);
    setPassword("");
    setShowPassword(false);
    setShowForm(true);
  }

  async function handleDelete() {
    if (!editingId) return;

    // Fail fast on a guard the server will refuse anyway, so the admin gets
    // the reason immediately instead of a round trip. Same pattern as the
    // deactivate path in handleSubmit.
    if (currentUserId) {
      const block = blockOnDelete(editingId, currentUserId, profiles);
      if (block) {
        toast.error(DELETE_BLOCK_MESSAGE[block]);
        setConfirmingDelete(false);
        return;
      }
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${editingId}`, { method: "DELETE" });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Gagal memadam pengguna. Cuba semula.");
        return;
      }

      toast.success(`${fullName.trim()} telah dipadam.`);
      setConfirmingDelete(false);
      closeForm();
      await loadProfiles();
    } catch {
      toast.error("Ralat tidak dijangka. Sila cuba semula.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!fullName.trim()) {
      toast.error("Nama penuh diperlukan.");
      return;
    }

    // Email and password are only settable at creation.
    if (!editingId) {
      if (!isMohEmail(cleanEmail)) {
        toast.error(`Hanya alamat e-mel @${MOH_DOMAIN} dibenarkan.`);
        return;
      }
      if (!isValidPassword(password)) {
        toast.error(PASSWORD_ERROR);
        return;
      }
    }

    // Fail fast on a guard the server will refuse anyway, so the admin gets
    // the reason immediately instead of a round trip.
    if (editingId && !isActive && currentUserId) {
      const block = blockOnDeactivate(editingId, currentUserId, profiles);
      if (block) {
        toast.error(DEACTIVATE_BLOCK_MESSAGE[block]);
        return;
      }
    }

    setSubmitting(true);

    try {
      const res = editingId
        ? await fetch(`/api/users/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              full_name: fullName.trim(),
              role,
              unit_name: unitName.trim() || null,
              is_active: isActive,
            }),
          })
        : await fetch("/api/register", {
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
        toast.error(
          result.error ||
            (editingId ? "Kemaskini gagal. Cuba semula." : "Pendaftaran gagal. Cuba semula."),
        );
        return;
      }

      toast.success(
        editingId
          ? `${fullName.trim()} berjaya dikemaskini.`
          : `${fullName.trim()} berjaya didaftarkan!`,
      );
      closeForm();
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
          <h1 className="text-title-1 font-semibold text-[var(--fg)] tracking-tight">
            Pengurusan Pengguna
          </h1>
          <p className="text-footnote text-[var(--fg-muted)] mt-1">
            {profiles.length} pengguna berdaftar dalam sistem
          </p>
        </div>
        <Button
          onClick={() => (showForm ? closeForm() : openCreate())}
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
              {editingId ? "Kemaskini Pengguna" : "Pendaftaran Pengguna Baharu"}
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
                disabled={!!editingId}
                placeholder={`email@${MOH_DOMAIN}`}
                trailing={
                  editingId ? (
                    <Lock size={16} className="text-[var(--fg-muted)]" />
                  ) : (
                    <Mail size={16} className="text-[var(--fg-muted)]" />
                  )
                }
                helper={
                  editingId
                    ? "Tidak boleh diubah."
                    : `Hanya alamat @${MOH_DOMAIN} dibenarkan.`
                }
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
                    const selected = role === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRole(opt.value)}
                        className={cn(
                          "h-11 rounded-md border text-caption font-semibold transition-all active:scale-95 uppercase tracking-wide",
                          selected
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

              {/* Password — only ever set at creation. */}
              {!editingId && (
                <div>
                  <Input
                    label="Kata Laluan"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Kata laluan sementara"
                    minLength={PASSWORD_MIN_LENGTH}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Sembunyikan kata laluan" : "Tunjukkan kata laluan"}
                        className="inline-flex items-center justify-center h-10 w-10 rounded-md text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--primary-tint)] transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                  <PasswordChecklist password={password} />
                </div>
              )}
            </div>

            {/* Account status — edit only; a new user is always created active. */}
            {editingId && (
              <div className="flex flex-col gap-1.5">
                <label className="text-subhead font-medium text-[var(--fg)]">
                  Status Akaun
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((opt) => {
                    const selected = isActive === opt.value;
                    return (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => setIsActive(opt.value)}
                        aria-pressed={selected}
                        className={cn(
                          "min-h-touch px-4 py-2.5 rounded-md border text-left transition-all active:scale-95",
                          selected && opt.value
                            ? "bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] shadow-sm"
                            : selected
                              ? "bg-[var(--destructive)] text-white border-[var(--destructive)] shadow-sm"
                              : "bg-[var(--bg)] text-[var(--fg-muted)] border-[var(--border)] hover:border-[var(--border-strong)]",
                        )}
                      >
                        <span className="block text-subhead font-semibold">{opt.label}</span>
                        <span className="block text-footnote opacity-80">{opt.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
              <Button
                type="submit"
                loading={submitting}
                className="flex-1"
              >
                {editingId ? "Simpan Perubahan" : "Daftar Pengguna"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeForm}>
                Batal
              </Button>
            </div>

            {/* Destructive action sits below its own divider, away from Simpan. */}
            {editingId && (
              <div className="pt-4 border-t border-[var(--border)]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmingDelete(true)}
                  className="gap-2 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                >
                  <Trash2 size={16} />
                  Padam Pengguna
                </Button>
                <p className="text-footnote text-[var(--fg-muted)] mt-1.5">
                  Tindakan ini kekal. Untuk menyekat log masuk sahaja, tetapkan status
                  kepada Tidak Aktif.
                </p>
              </div>
            )}
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
              onClick={() => openEdit(p)}
              className={cn(!p.is_active && "opacity-60")}
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
                <div className="flex items-center gap-1.5">
                  {!p.is_active && (
                    <span className="bg-[var(--destructive)] text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm">
                      Tidak Aktif
                    </span>
                  )}
                  <span className="bg-[var(--primary-tint)] text-[var(--primary)] text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border border-[var(--primary)] border-opacity-20">
                    {ROLE_LABELS[p.role]}
                  </span>
                </div>
              }
            />
          ))
        )}
      </div>

      {/* Not window.confirm: unstyled, untranslatable, and it blocks the
          event loop. */}
      <Modal
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Padam Pengguna?"
        description="Tindakan ini tidak boleh dibatalkan."
      >
        <div className="space-y-4">
          <p className="text-subhead text-[var(--fg)]">
            Akaun <span className="font-semibold">{fullName}</span> ({email}) akan
            dipadam kekal. Permohonan dan rekod audit yang pernah dibuat akan kekal,
            tetapi tanpa nama pemohon.
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              loading={deleting}
              onClick={handleDelete}
              className="flex-1 bg-[var(--destructive)] hover:opacity-90 border-none text-white"
            >
              Ya, Padam
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmingDelete(false)}
            >
              Batal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
