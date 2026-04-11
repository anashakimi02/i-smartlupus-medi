"use client";

import { useState, useRef } from "react";
import NextImage from "next/image";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

async function compressImage(file: File, maxWidth = 800, quality = 0.7): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
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

interface PhotoUploadProps {
  ticketId: string;
  onUploaded: (url: string) => void;
}

export default function PhotoUpload({ ticketId, onUploaded }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Sila pilih fail gambar.");
      return;
    }

    setLoading(true);
    try {
      const compressed = await compressImage(file);
      const path = `photos/${ticketId}/asset-photo.jpg`;

      const { error } = await supabase.storage
        .from("disposal-files")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });

      if (error) throw error;

      const { data } = supabase.storage.from("disposal-files").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      setPreview(publicUrl);
      onUploaded(publicUrl);
      toast.success("Foto berjaya dimuat naik.");
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat naik foto.");
    } finally {
      setLoading(false);
    }
  }

  function handleRemove() {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="w-full">
      {preview ? (
        <div className="relative rounded-xl overflow-hidden">
          <div className="relative w-full h-48 rounded-xl overflow-hidden">
            <NextImage src={preview} alt="Pratonton foto aset" fill className="object-cover" unoptimized />
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-white rounded-full p-2.5 shadow-md"
            aria-label="Buang gambar"
          >
            <X className="h-4 w-4 text-gray-700" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-8 text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          <Camera className="h-8 w-8" />
          <span className="text-sm font-medium">
            {loading ? "Memuat naik..." : "Tekan untuk ambil gambar"}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
