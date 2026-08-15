"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { Send, AlertCircle, Camera, FileText, X } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { AssetCondition, AssetCategory, AssetSubCategory } from "@/lib/supabase/types";
import { ASSET_CONDITIONS, ASSET_CATEGORIES, ASSET_SUB_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  validatePhotoFile,
  validateBorangFile,
  borangExtension,
  photoStoragePath,
  borangStoragePath,
  canSubmitMohon,
} from "@/lib/disposal/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

async function compressImage(file: File, maxWidth = 800, quality = 0.7): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const canvas = document.createElement("canvas");
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob!), "image/jpeg", quality);
    };
    img.src = URL.createObjectURL(file);
  });
}

export default function MohonPage() {
  const router = useRouter();
  const supabase = createClient();

  const [category, setCategory] = useState<AssetCategory>("harta_modal");
  const [subCategory, setSubCategory] = useState<AssetSubCategory>("alat_perubatan");
  const [serialNo, setSerialNo] = useState("");
  const [assetType, setAssetType] = useState("");
  const [radicareAssetNo, setRadicareAssetNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [assetCondition, setAssetCondition] = useState<AssetCondition>("rosak");
  const [location, setLocation] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Set when submission succeeds. Holds the ticket number so the modal can
  // show it; null means the modal is closed.
  const [submittedTicketNo, setSubmittedTicketNo] = useState<string | null>(null);

  // Files are held in memory while filling the form; uploaded after the ticket
  // is created on submit, so an abandoned form never orphans storage objects.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [borangFile, setBorangFile] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const borangInputRef = useRef<HTMLInputElement>(null);

  // Any dismissal — OK, the X, or Escape — means the applicant has seen it.
  // Only ever go forward. Mirrors the push+refresh pair the submit path used
  // to run inline.
  function leaveToStatus() {
    router.push("/status");
    router.refresh();
  }

  function selectSubCategory(sub: AssetSubCategory) {
    setSubCategory(sub);
    // Borang CA only applies to alat_perubatan; drop a held file if switching away.
    if (sub !== "alat_perubatan") {
      setBorangFile(null);
      if (borangInputRef.current) borangInputRef.current.value = "";
    }
  }

  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = validatePhotoFile(file);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handlePhotoRemove() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function handleBorangPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = validateBorangFile(file);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setBorangFile(file);
  }

  function handleBorangRemove() {
    setBorangFile(null);
    if (borangInputRef.current) borangInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const gate = canSubmitMohon({ assetType, subCategory, hasBorang: !!borangFile });
    if (!gate.ok) {
      toast.error(gate.error);
      return;
    }

    setIsLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error("Sesi tamat. Sila log masuk semula.");
        return;
      }

      const { data: ticket, error: insertError } = await supabase.rpc(
        "submit_disposal_ticket",
        {
          p_asset_condition: assetCondition,
          p_location: location.trim() || null,
          p_category: category,
          p_sub_category: subCategory,
          p_serial_no: serialNo.trim() || null,
          p_asset_type: assetType.trim(),
          p_radicare_asset_no: radicareAssetNo.trim() || null,
          p_purchase_date: purchaseDate || null,
          p_purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
        },
      );

      if (insertError || !ticket) {
        toast.error("Permohonan gagal dihantar. Sila cuba lagi.");
        return;
      }

      // Ticket exists — now upload the held files keyed by its id.
      if (photoFile) {
        try {
          const compressed = await compressImage(photoFile);
          const path = photoStoragePath(ticket.id);
          const { error: uploadError } = await supabase.storage
            .from("disposal-files")
            .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
          if (uploadError) throw uploadError;
          const { error: attachError } = await supabase.rpc("attach_disposal_photo", {
            p_ticket_id: ticket.id,
            p_image_path: path,
          });
          if (attachError) throw attachError;
        } catch {
          toast.error("Permohonan dihantar, tetapi foto gagal dimuat naik.");
        }
      }

      if (borangFile) {
        try {
          const ext = borangExtension(borangFile.type);
          const path = borangStoragePath(ticket.id, ext);
          const { error: uploadError } = await supabase.storage
            .from("disposal-files")
            .upload(path, borangFile, { upsert: true, contentType: borangFile.type });
          if (uploadError) throw uploadError;
          const { error: attachError } = await supabase.rpc("attach_disposal_borang_ca", {
            p_ticket_id: ticket.id,
            p_borang_path: path,
          });
          if (attachError) throw attachError;
        } catch {
          toast.error("Permohonan dihantar, tetapi Borang CA gagal dimuat naik.");
        }
      }

      setSubmittedTicketNo(ticket.ticket_no);
    } catch {
      toast.error("Ralat tidak dijangka. Sila cuba lagi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <header className="py-2">
        <h1 className="text-display font-bold text-[var(--fg)] tracking-tight">
          Permohonan Baru
        </h1>
        <p className="text-body font-medium text-[var(--fg-muted)] mt-1">
          Sila lengkapkan butiran aset
        </p>
      </header>

      {/* Form Card */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6 shadow-none">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            {/* Kategori Aset */}
            <div className="space-y-2">
              <span className="text-subhead font-medium text-[var(--fg)]">
                Kategori Aset
                <span className="text-[var(--destructive)] ml-0.5" aria-hidden="true">*</span>
              </span>
              <div className="flex gap-2">
                {(Object.keys(ASSET_CATEGORIES) as AssetCategory[]).map((cat) => {
                  const isActive = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "flex-1 h-11 rounded-md border text-subhead font-medium transition-all active:scale-95 flex items-center justify-center gap-2",
                        isActive
                          ? "bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] shadow-sm"
                          : "bg-[var(--bg)] text-[var(--fg-muted)] border-[var(--border)] hover:border-[var(--border-strong)]"
                      )}
                    >
                      {ASSET_CATEGORIES[cat]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sub-Kategori */}
            <div className="space-y-3">
              <span className="text-subhead font-medium text-[var(--fg)]">
                Sub-Kategori
                <span className="text-[var(--destructive)] ml-0.5" aria-hidden="true">*</span>
              </span>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(ASSET_SUB_CATEGORIES) as AssetSubCategory[]).map((sub) => {
                  const isActive = subCategory === sub;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => selectSubCategory(sub)}
                      className={cn(
                        "flex items-center gap-3 px-4 h-12 rounded-md border text-body transition-all active:scale-[0.98]",
                        isActive
                          ? "bg-[var(--primary-tint)] text-[var(--primary)] border-[var(--primary)]"
                          : "bg-[var(--surface)] text-[var(--fg-muted)] border-[var(--border)] hover:border-[var(--border-strong)]"
                      )}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded-full border flex items-center justify-center transition-colors",
                        isActive ? "border-[var(--primary)]" : "border-[var(--border-strong)]"
                      )}>
                        {isActive && <div className="h-2 w-2 rounded-full bg-[var(--primary)]" />}
                      </div>
                      {ASSET_SUB_CATEGORIES[sub]}
                    </button>
                  );
                })}
              </div>
            </div>

            {subCategory === "alat_perubatan" && (
              <div className="rounded-md border border-[var(--primary)] bg-[var(--primary-tint)] p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-subhead font-semibold text-[var(--primary)] flex items-center gap-2">
                    <FileText size={16} /> Borang CA (Laporan Kerosakan Aset)
                    <span className="text-[var(--destructive)]" aria-hidden="true">*</span>
                  </p>
                  <p className="text-footnote text-[var(--fg-muted)]">
                    Wajib dimuat naik untuk aset alat perubatan sebelum menghantar permohonan.
                  </p>
                </div>

                {borangFile ? (
                  <div className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                    <FileText size={18} className="text-[var(--primary)] shrink-0" />
                    <span className="text-footnote font-medium text-[var(--fg)] truncate flex-1">
                      {borangFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={handleBorangRemove}
                      className="text-[var(--destructive)] hover:opacity-70 transition-opacity active:scale-95 shrink-0"
                      aria-label="Buang Borang CA"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => borangInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-[var(--border)] bg-[var(--surface)] py-6 text-[var(--fg-muted)] hover:border-[var(--primary)] hover:bg-[var(--primary-tint)] hover:text-[var(--primary)] transition-all active:scale-[0.99]"
                  >
                    <FileText className="h-6 w-6" />
                    <span className="text-subhead font-semibold">Muat Naik Borang CA</span>
                    <span className="text-caption opacity-60">Format PDF, JPG atau PNG (Maks 10MB)</span>
                  </button>
                )}
                <input
                  ref={borangInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={handleBorangPick}
                />
              </div>
            )}

            {/* No. Siri Pendaftaran */}
            <Input
              label="No. Siri Pendaftaran"
              required
              value={serialNo}
              onChange={(e) => setSerialNo(e.target.value)}
              placeholder="Cth: KKM/HOSP/2024/001"
            />

            {/* Jenis/Jenama/Model Aset */}
            <Input
              label="Jenis/Jenama/Model Aset"
              required
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              placeholder="Cth: Ventilator Dräger Evita V300"
            />

            {/* No. Aset Radicare */}
            <Input
              label="No. Aset Radicare"
              value={radicareAssetNo}
              onChange={(e) => setRadicareAssetNo(e.target.value)}
              placeholder="Cth: RAD-2024-00123"
              helper="Biarkan kosong jika tiada no. aset Radicare."
            />

            {/* Tarikh Perolehan / Tarikh Diterima */}
            <Input
              label="Tarikh Perolehan / Tarikh Diterima"
              required
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />

            {/* Harga Perolehan Asal (RM) */}
            <Input
              label="Harga Perolehan Asal (RM)"
              required
              type="number"
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="0.00"
            />

            {/* Keadaan Aset */}
            <div className="space-y-2">
              <span className="text-subhead font-medium text-[var(--fg)]">
                Keadaan Aset
                <span className="text-[var(--destructive)] ml-0.5" aria-hidden="true">*</span>
              </span>
              <div className="flex gap-2">
                {(Object.keys(ASSET_CONDITIONS) as AssetCondition[]).map(
                  (condition) => {
                    const isActive = assetCondition === condition;
                    return (
                      <button
                        key={condition}
                        type="button"
                        onClick={() => setAssetCondition(condition)}
                        className={cn(
                          "flex-1 h-11 rounded-md border text-subhead font-medium transition-all active:scale-95 flex items-center justify-center gap-2",
                          isActive
                            ? "bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] shadow-sm"
                            : "bg-[var(--bg)] text-[var(--fg-muted)] border-[var(--border)] hover:border-[var(--border-strong)]"
                        )}
                      >
                        {isActive && <AlertCircle size={14} />}
                        {ASSET_CONDITIONS[condition]}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Lokasi */}
            <Input
              label="Lokasi"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Cth: Wad 3A, Tingkat 2"
            />
            
            {/* Foto Aset Section */}
            <div className="space-y-2">
              <span className="text-subhead font-medium text-[var(--fg)] flex items-center gap-2">
                <Camera size={16} className="text-[var(--primary)]" />
                Foto Aset (Untuk Dilupuskan)
              </span>
              <p className="text-footnote text-[var(--fg-muted)] mb-4">
                Sila ambil gambar aset sebagai bukti keadaan semasa.
              </p>

              {photoPreview ? (
                <div className="relative group animate-in">
                  <div className="relative w-full aspect-[4/3] rounded-md overflow-hidden border border-[var(--border)]">
                    <NextImage
                      src={photoPreview}
                      alt="Pratonton foto aset"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handlePhotoRemove}
                    className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-sm text-[var(--destructive)] hover:bg-[var(--destructive)] hover:text-white transition-all active:scale-95"
                    aria-label="Buang gambar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-[var(--border)] bg-[var(--surface)] py-10 text-[var(--fg-muted)] hover:border-[var(--primary)] hover:bg-[var(--primary-tint)] hover:text-[var(--primary)] transition-all active:scale-[0.99]"
                >
                  <div className="p-4 rounded-full bg-[var(--bg)] text-[var(--fg-muted)]">
                    <Camera className="h-8 w-8" />
                  </div>
                  <div className="text-center space-y-1">
                    <span className="text-body font-semibold">Ambil Foto Aset</span>
                    <p className="text-caption opacity-60">Format JPG atau PNG (Maks 5MB)</p>
                  </div>
                </button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoPick}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              size="lg"
              className="w-full gap-2"
              loading={isLoading}
            >
              <Send className="h-5 w-5" />
              Hantar Permohonan
            </Button>
            <p className="text-center text-caption text-[var(--fg-muted)] mt-4">
              Pastikan maklumat aset adalah tepat sebelum menghantar.
            </p>
          </div>
        </form>
      </div>

      <Modal
        open={submittedTicketNo !== null}
        onOpenChange={(next) => {
          if (!next) leaveToStatus();
        }}
        title="Permohonan Berjaya Dihantar"
      >
        <div className="space-y-4">
          <p className="text-subhead text-[var(--fg)]">
            Permohonan anda telah berjaya dihantar.
          </p>
          <p className="text-subhead text-[var(--fg)]">
            Semakan permohonan akan dibuat dalam tiga (3) hari bekerja.
          </p>
          <p className="text-footnote text-[var(--fg-muted)]">
            No. Rujukan:{" "}
            <span className="font-semibold text-[var(--fg)]">{submittedTicketNo}</span>
          </p>
          <Button className="w-full" onClick={leaveToStatus}>
            OK
          </Button>
        </div>
      </Modal>
    </div>
  );
}
