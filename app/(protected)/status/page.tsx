"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DisposalTicket } from "@/lib/supabase/types";
import TicketCard from "@/components/TicketCard";
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

  if (loading) return <p className="text-sm text-slate-400 py-8 text-center">Memuatkan...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Status Permohonan</h1>
        <p className="text-sm text-slate-500 mt-1">Senarai permohonan pelupusan anda</p>
      </div>

      {!tickets.length ? (
        <div className="text-center py-12">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Tiada permohonan lagi.</p>
          <p className="text-xs text-slate-300 mt-1">Tekan &quot;Mohon&quot; untuk memulakan.</p>
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
