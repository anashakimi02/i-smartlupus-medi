import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { DisposalTicket } from "@/lib/supabase/types";
import StatusBadge from "@/components/StatusBadge";

interface TicketCardProps {
  ticket: DisposalTicket;
}

export default function TicketCard({ ticket }: TicketCardProps) {
  return (
    <Link href={`/semua/${ticket.id}`}>
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-center gap-3">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Ticket number + status */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
              {ticket.ticket_no}
            </span>
            <StatusBadge status={ticket.status} />
          </div>

          {/* Asset name */}
          <p className="text-sm font-bold text-slate-900 truncate">
            {ticket.asset_name}
          </p>

          {/* Unit / location */}
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {ticket.location}
          </p>

          {/* Created date */}
          <p className="text-[10px] text-slate-300 mt-1">
            {formatDate(ticket.created_at)}
          </p>
        </div>

        {/* Chevron */}
        <ChevronRight size={16} className="text-slate-300 shrink-0" />
      </div>
    </Link>
  );
}
