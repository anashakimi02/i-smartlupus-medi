import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DisposalTicket } from "@/lib/supabase/types";
import TicketCard from "@/components/TicketCard";

export default async function StatusPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: tickets } = await supabase
    .from("disposal_tickets")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  const rows: DisposalTicket[] = tickets ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">
          Status Permohonan
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Senarai permohonan pelupusan anda
        </p>
      </div>

      {/* Content */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ClipboardList size={48} className="text-slate-200 mb-4" />
          <p className="text-sm font-semibold text-slate-400">
            Tiada permohonan lagi.
          </p>
          <p className="text-xs text-slate-300 mt-1">
            Tekan &apos;Mohon&apos; untuk memulakan.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
