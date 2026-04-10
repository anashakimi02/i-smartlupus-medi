"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

import { createClient } from "@/lib/supabase/client";
import type { DisposalTicket } from "@/lib/supabase/types";
import { DISPOSAL_METHODS, ASSET_CONDITIONS } from "@/lib/constants";

interface Props {
  ticket: DisposalTicket;
  officerName: string;
}

// DB row may have extra fields not in the TS type
type TicketRow = DisposalTicket & Record<string, unknown>;

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("ms-MY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

function generateCertPdf(ticket: DisposalTicket, officerName: string): Blob {
  const row = ticket as TicketRow;

  const ticketNo =
    (row.ticket_no as string | undefined) ?? ticket.ticket_no ?? ticket.id;
  const inventoryId = (row.inventory_id as string | undefined) ?? "-";
  const location = (row.location as string | undefined) ?? "-";
  const completedAt =
    (row.completed_at as string | undefined) ?? (row.updated_at as string | undefined) ?? null;

  const conditionLabel =
    ticket.asset_condition ? ASSET_CONDITIONS[ticket.asset_condition] ?? ticket.asset_condition : "-";
  const methodLabel =
    ticket.disposal_method ? DISPOSAL_METHODS[ticket.disposal_method] ?? ticket.disposal_method : "-";

  const doc = new jsPDF();

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("SIJIL PELUPUSAN ASET", 105, 30, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("i-SMARTLUPUS MEDI", 105, 40, { align: "center" });

  // Ticket number
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`No. Tiket: ${ticketNo}`, 20, 55);

  // Details table
  const details: Array<[string, string]> = [
    ["Nama Aset", ticket.asset_name ?? "-"],
    ["No. Inventori", inventoryId],
    ["Keadaan", conditionLabel],
    ["Lokasi", location],
    ["Kaedah Pelupusan", methodLabel],
    ["Tarikh Permohonan", formatDate(ticket.created_at)],
    ["Tarikh Selesai", formatDate(completedAt)],
    ["Pegawai Pelupusan", officerName],
  ];

  doc.setFontSize(10);
  let y = 70;
  for (const [label, value] of details) {
    doc.setFont("helvetica", "bold");
    doc.text(label, 20, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 80, y);
    y += 8;
  }

  // Signature section
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.text("Disahkan oleh:", 20, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.line(20, y, 90, y);

  y += 6;
  doc.text(officerName, 20, y);

  y += 6;
  doc.text(formatDate(new Date().toISOString()), 20, y);

  return doc.output("blob");
}

export default function CertificateGenerator({ ticket, officerName }: Props) {
  const [loading, setLoading] = useState(false);

  // Only render when ticket is selesai AND cert_url is not yet generated
  const row = ticket as TicketRow;
  const certUrl = row.cert_url as string | null | undefined;
  if (ticket.status !== "selesai" || certUrl) return null;

  async function handleGenerate() {
    setLoading(true);
    try {
      const supabase = createClient();

      // 1. Generate PDF blob
      const blob = generateCertPdf(ticket, officerName);

      // 2. Upload to Supabase Storage
      const storagePath = `certificates/${ticket.id}/sijil-pelupusan.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("disposal-files")
        .upload(storagePath, blob, {
          upsert: true,
          contentType: "application/pdf",
        });

      if (uploadError) throw uploadError;

      // 3. Get public URL
      const { data: urlData } = supabase.storage
        .from("disposal-files")
        .getPublicUrl(storagePath);
      const publicUrl = urlData.publicUrl;

      // 4. Update ticket: cert_url
      const { error: ticketError } = await supabase
        .from("disposal_tickets")
        .update({ cert_url: publicUrl })
        .eq("id", ticket.id);

      if (ticketError) throw ticketError;

      // 5. Get current user for audit log
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 6. Insert audit_log
      const { error: logError } = await supabase.from("audit_logs").insert({
        ticket_id: ticket.id,
        performed_by: user?.id ?? null,
        action: "sijil_dijana",
        new_value: publicUrl,
      });

      if (logError) throw logError;

      // 7. Toast + reload
      toast.success("Sijil pelupusan berjaya dijana!");
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error("Gagal menjana sijil. Sila cuba semula.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <p className="mb-4 text-xs font-black uppercase tracking-wider text-slate-400">
        Sijil Pelupusan
      </p>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-50"
      >
        <FileText size={18} />
        {loading ? "Menjana sijil..." : "Jana Sijil Pelupusan"}
      </button>
    </div>
  );
}
