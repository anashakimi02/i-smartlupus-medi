"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, X, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { DisposalTicket } from "@/lib/supabase/types";
import { ASSET_CONDITIONS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";

export default function SemakanPage() {
  const [tickets, setTickets] = useState<DisposalTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("disposal_tickets")
      .select("*")
      .eq("status", "menunggu_semakan")
      .order("created_at", { ascending: true });
    setTickets(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  async function handleLulus(ticket: DisposalTicket) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("disposal_tickets")
      .update({
        status: "proses_pelupusan",
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq("id", ticket.id);

    if (updateError) {
      toast.error("Gagal meluluskan permohonan.");
      return;
    }

    await supabase.from("audit_logs").insert({
      ticket_id: ticket.id,
      performed_by: user.id,
      action: "semakan_lulus",
      old_value: "menunggu_semakan",
      new_value: "proses_pelupusan",
      notes: null,
    });

    toast.success(`${ticket.ticket_no} telah diluluskan.`);
    await loadTickets();
  }

  async function handleTolak(ticketId: string) {
    if (!rejectReason.trim()) {
      toast.error("Sila masukkan sebab penolakan.");
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("disposal_tickets")
      .update({
        status: "ditolak",
        rejection_reason: rejectReason.trim(),
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq("id", ticketId);

    if (updateError) {
      toast.error("Gagal menolak permohonan.");
      return;
    }

    await supabase.from("audit_logs").insert({
      ticket_id: ticketId,
      performed_by: user.id,
      action: "semakan_ditolak",
      old_value: "menunggu_semakan",
      new_value: "ditolak",
      notes: rejectReason.trim(),
    });

    toast.success("Permohonan telah ditolak.");
    setRejectId(null);
    setRejectReason("");
    await loadTickets();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">
          Semakan Permohonan
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {loading
            ? "Memuatkan..."
            : `${tickets.length} permohonan menunggu semakan`}
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ClipboardCheck size={48} className="text-slate-200 mb-4" />
          <p className="text-sm font-semibold text-slate-400">
            Tiada permohonan menunggu.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3"
            >
              {/* Top row: ticket number + status badge */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                  {ticket.ticket_no}
                </span>
                <StatusBadge status={ticket.status} />
              </div>

              {/* Asset name */}
              <p className="text-sm font-bold text-slate-900">
                {ticket.asset_name}
              </p>

              {/* Meta: condition / location / date */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                <span>{ASSET_CONDITIONS[ticket.asset_condition]}</span>
                <span>·</span>
                <span>{ticket.location}</span>
                <span>·</span>
                <span>{formatDate(ticket.created_at)}</span>
              </div>

              {/* Rejection textarea (shown when this ticket is being rejected) */}
              {rejectId === ticket.id && (
                <div className="space-y-2 pt-1">
                  <textarea
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                    rows={3}
                    placeholder="Sebab penolakan..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setRejectId(null);
                        setRejectReason("");
                      }}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => handleTolak(ticket.id)}
                      className="flex-1 rounded-xl bg-red-50 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                    >
                      <X size={13} />
                      Tolak
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons (hidden while rejection form is open for this ticket) */}
              {rejectId !== ticket.id && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleLulus(ticket)}
                    className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <Check size={13} />
                    Lulus
                  </button>
                  <button
                    onClick={() => {
                      setRejectId(ticket.id);
                      setRejectReason("");
                    }}
                    className="flex-1 rounded-xl bg-red-50 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                  >
                    <X size={13} />
                    Tolak
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
