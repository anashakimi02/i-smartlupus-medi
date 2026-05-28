"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { AttentionRow } from "@/lib/dashboard/pemohon";

interface AttentionTableProps {
  rows: AttentionRow[];
}

export function AttentionTable({ rows }: AttentionTableProps) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-8 w-8" aria-hidden />}
        title="Tiada permohonan memerlukan perhatian"
        description="Semua permohonan anda sedang berjalan lancar."
      />
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <ul role="list">
        {rows.map((row, idx) => (
          <li
            key={row.id}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--primary-tint)] transition-colors ${
              idx > 0 ? "border-t border-[var(--border)]" : ""
            }`}
            // TODO(future-feature): when /mohon/${id}/edit ships, swap target
            // for reason==="ditolak" to /mohon/${id}/edit so the requester can
            // jump directly into revision flow. For now both row types route
            // to the read-only detail view, which already surfaces
            // rejection_reason inline.
            onClick={() => router.push(`/semua/${row.id}`)}
          >
            <span
              data-severity={row.reason}
              aria-hidden
              className="h-2 w-2 rounded-full shrink-0"
              style={{
                backgroundColor:
                  row.reason === "ditolak"
                    ? "var(--dim-severity-critical)"
                    : "var(--dim-severity-aging)",
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-caption font-semibold text-[var(--primary)] uppercase tracking-wide">
                  {row.ticket_no}
                </span>
                <span className="text-body text-[var(--fg)] truncate">
                  {row.asset_name}
                </span>
              </div>
              <p className="text-footnote text-[var(--fg-muted)] truncate mt-0.5">
                {row.reason === "ditolak"
                  ? `Pindaan: ${row.rejection_reason ?? "—"}`
                  : `Menunggu ${row.age_days} hari`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
