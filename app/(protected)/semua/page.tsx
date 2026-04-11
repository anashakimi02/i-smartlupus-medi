"use client";

import { useEffect, useState } from "react";
import { Search, List } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DisposalTicket, TicketStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import TicketCard from "@/components/TicketCard";

type FilterValue = "all" | TicketStatus;

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "menunggu_semakan", label: "Menunggu" },
  { value: "proses_pelupusan", label: "Proses" },
  { value: "selesai", label: "Selesai" },
  { value: "ditolak", label: "Ditolak" },
];

export default function SemuaPage() {
  const [tickets, setTickets] = useState<DisposalTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchTickets = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("disposal_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) {
        setTickets(data as DisposalTicket[]);
      }
    };

    fetchTickets();
  }, []);

  const filtered = tickets.filter((ticket) => {
    const matchesStatus =
      statusFilter === "all" || ticket.status === statusFilter;

    const query = search.toLowerCase();
    const matchesSearch =
      !query ||
      ticket.ticket_no.toLowerCase().includes(query) ||
      ticket.asset_name.toLowerCase().includes(query) ||
      (ticket.location || "").toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Semua Tiket</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {filtered.length} jumlah tiket
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari tiket, aset, lokasi..."
          className="w-full bg-white rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
        {FILTER_OPTIONS.map((option) => {
          const isActive = statusFilter === option.value;
          return (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              className={cn(
                "shrink-0 rounded-full px-5 py-2.5 text-sm font-medium border transition-colors",
                isActive
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Ticket list */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <List size={40} className="text-slate-300" />
          <p className="text-sm">Tiada tiket ditemui.</p>
        </div>
      )}
    </div>
  );
}
