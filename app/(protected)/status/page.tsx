"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DisposalTicket } from "@/lib/supabase/types";
import TicketCard from "@/components/TicketCard";
import { TicketListSkeleton } from "@/components/Skeleton";
import { ClipboardList } from "lucide-react";

export default function StatusPage() {
  const [tickets, setTickets] = useState<DisposalTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("disposal_tickets")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      setTickets((data as DisposalTicket[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Status Permohonan</h1>
        <p className="text-sm text-slate-500 mt-1">Senarai permohonan pelupusan anda</p>
      </div>
      <TicketListSkeleton count={4} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Status Permohonan</h1>
        <p className="text-sm text-slate-500 mt-1">Senarai permohonan pelupusan anda</p>
      </div>

      {!tickets.length ? (
        <div className="text-center py-16 px-6">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-blue-400" />
          </div>
          <p className="text-base font-semibold text-slate-700">Belum ada permohonan</p>
          <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">
            Untuk memulakan pelupusan aset, tekan butang <strong className="text-blue-600">Mohon</strong> di menu bawah.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
