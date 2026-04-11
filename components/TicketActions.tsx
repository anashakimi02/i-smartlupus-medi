"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type { DisposalTicket, DisposalMethod } from "@/lib/supabase/types";
import { DISPOSAL_METHODS } from "@/lib/constants";

interface Props {
  ticket: DisposalTicket;
}

export default function TicketActions({ ticket }: Props) {
  const [method, setMethod] = useState<DisposalMethod | "">("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (ticket.status !== "proses_pelupusan") return null;

  async function handleComplete() {
    if (!method) {
      toast.error("Sila pilih kaedah pelupusan.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Sesi tamat. Sila log masuk semula.");
        return;
      }

      // Update ticket
      const { error: ticketError } = await supabase
        .from("disposal_tickets")
        .update({
          status: "selesai",
          disposal_method: method,
          completed_by: user.id,
          completed_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);

      if (ticketError) throw ticketError;

      const ticketNo =
        (ticket as unknown as Record<string, unknown>).ticket_no as
          | string
          | undefined;
      const ticketRef = ticketNo ?? ticket.ticket_no ?? ticket.id;

      // Insert audit log: kaedah_dipilih
      const { error: log1Error } = await supabase.from("audit_logs").insert({
        ticket_id: ticket.id,
        performed_by: user.id,
        action: "kaedah_dipilih",
        new_value: method,
      });

      if (log1Error) throw log1Error;

      // Insert audit log: pelupusan_selesai
      const { error: log2Error } = await supabase.from("audit_logs").insert({
        ticket_id: ticket.id,
        performed_by: user.id,
        action: "pelupusan_selesai",
        old_value: "proses_pelupusan",
        new_value: "selesai",
      });

      if (log2Error) throw log2Error;

      toast.success(`${ticketRef} telah diselesaikan!`);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Ralat berlaku. Sila cuba semula.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <p className="mb-4 text-xs font-black uppercase tracking-wider text-slate-400">
        Pelaksanaan Pelupusan
      </p>

      {/* Method selection grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {(Object.entries(DISPOSAL_METHODS) as [DisposalMethod, string][]).map(
          ([key, label]) => {
            const isActive = method === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMethod(key)}
                className={[
                  "rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300",
                ].join(" ")}
              >
                {label}
              </button>
            );
          }
        )}
      </div>

      {/* Complete button */}
      <button
        type="button"
        onClick={handleComplete}
        disabled={!method || loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-50"
      >
        <CheckCircle size={18} />
        {loading ? "Memproses..." : "Selesaikan Pelupusan"}
      </button>
    </div>
  );
}
