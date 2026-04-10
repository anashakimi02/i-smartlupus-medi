import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Camera } from "lucide-react";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DisposalTicket, AuditLog } from "@/lib/supabase/types";
import { ASSET_CONDITIONS, DISPOSAL_METHODS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import TicketActions from "@/components/TicketActions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: ticket } = await supabase
    .from("disposal_tickets")
    .select("*")
    .eq("id", id)
    .single<DisposalTicket>();

  if (!ticket) {
    notFound();
  }

  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  const logs: AuditLog[] = auditLogs ?? [];

  return (
    <div className="space-y-6">
      {/* Back Button + Ticket Number + Status */}
      <div className="flex items-center gap-3">
        <Link
          href="/semua"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex flex-1 items-center gap-3">
          <span className="text-lg font-black text-slate-900">
            {(ticket as unknown as Record<string, unknown>).ticket_no as string ?? ticket.ticket_number ?? id.slice(0, 8).toUpperCase()}
          </span>
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      {/* Maklumat Aset Card */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="mb-4 text-xs font-black uppercase tracking-wider text-slate-400">
          Maklumat Aset
        </p>

        <div className="grid grid-cols-2 gap-3">
          {/* Nama Aset */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Nama Aset
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">
              {ticket.asset_name}
            </p>
          </div>

          {/* No. Inventori */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              No. Inventori
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">
              {(ticket as unknown as Record<string, unknown>).inventory_id as string || "-"}
            </p>
          </div>

          {/* Keadaan */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Keadaan
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">
              {ASSET_CONDITIONS[ticket.asset_condition]}
            </p>
          </div>

          {/* Lokasi */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Lokasi
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">
              {(ticket as unknown as Record<string, unknown>).location as string || "-"}
            </p>
          </div>

          {/* Kaedah Pelupusan */}
          {ticket.disposal_method && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Kaedah Pelupusan
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {DISPOSAL_METHODS[ticket.disposal_method]}
              </p>
            </div>
          )}

          {/* Tarikh Mohon */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Tarikh Mohon
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">
              {formatDateTime(ticket.created_at)}
            </p>
          </div>
        </div>

        {/* Sebab Ditolak */}
        {ticket.rejection_reason && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-red-500">
              Sebab Ditolak
            </p>
            <p className="text-sm text-red-700">{ticket.rejection_reason}</p>
          </div>
        )}

        {/* Foto Aset */}
        {(ticket as unknown as Record<string, unknown>).image_url && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Camera size={14} className="text-slate-400" />
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Foto Aset
              </p>
            </div>
            <img
              src={(ticket as unknown as Record<string, unknown>).image_url as string}
              alt="Foto aset"
              className="w-full rounded-xl object-cover"
            />
          </div>
        )}

        {/* Muat Turun Sijil */}
        {(ticket as unknown as Record<string, unknown>).cert_url && (
          <div className="mt-4">
            <a
              href={(ticket as unknown as Record<string, unknown>).cert_url as string}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <FileText size={16} />
              Muat Turun Sijil Pelupusan
            </a>
          </div>
        )}
      </div>

      {/* Pelaksanaan Pelupusan */}
      <TicketActions ticket={ticket} />

      {/* Jejak Audit Card */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="mb-4 text-xs font-black uppercase tracking-wider text-slate-400">
          Jejak Audit
        </p>

        {logs.length === 0 ? (
          <p className="text-sm text-slate-400">Tiada rekod audit.</p>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => {
              const rawLog = log as unknown as Record<string, unknown>;
              const oldValue = rawLog.old_value as string | null | undefined;
              const newValue = rawLog.new_value as string | null | undefined;
              const actionLabel = log.action.replace(/_/g, " ");

              return (
                <div key={log.id} className="flex gap-3">
                  {/* Blue dot */}
                  <div className="mt-1.5 flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-blue-400" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold capitalize text-slate-800">
                      {actionLabel}
                    </p>
                    {oldValue && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        <span className="line-through">{oldValue}</span>
                        {" → "}
                        <span>{newValue ?? "-"}</span>
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {formatDateTime(log.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
