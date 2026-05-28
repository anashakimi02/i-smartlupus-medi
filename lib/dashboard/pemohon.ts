import { createClient } from "@/lib/supabase/client";
import type { AssetCategory, AssetCondition, TicketStatus } from "@/lib/supabase/types";
import type {
  KpiDelta,
  SparkPoint,
  HistogramBucket,
  CategoryMix,
  ActivityEntry,
  DailyFlow,
} from "./types";
import {
  median,
  pctChange,
  bucketDurations,
  isoDate,
  daysAgo,
  diffHours,
  buildDailySeries,
  buildDailyMedian,
  buildDualLine,
} from "./helpers";

// ─── Public types ──────────────────────────────────────────────────────

export interface AttentionRow {
  id: string;
  ticket_no: string;
  asset_name: string;
  reason: "ditolak" | "menunggu_lama";
  age_days: number;
  rejection_reason: string | null;
}

export interface PemohonDashboardData {
  kpis: {
    activeCount: number;
    approved30d: KpiDelta;
    medianApprovalHours: KpiDelta;
    approvalRate: KpiDelta;
    approvedSparkline: SparkPoint[];
    medianSparkline: SparkPoint[];
    approvalRateSparkline: SparkPoint[];
  };
  workflow: DailyFlow[];
  statusBreakdown: { name: string; value: number; color: string }[];
  approvalDuration: { buckets: HistogramBucket[]; medianHours: number };
  categoryMix: CategoryMix;
  attentionRows: AttentionRow[];
  activityFeed: ActivityEntry[];
  isBrandNewUser: boolean;
}

// ─── Pure helpers (testable in isolation) ──────────────────────────────

/**
 * Picks up to 5 attention rows for the dashboard.
 * Ditolak rows are prioritized (most recent first, by input order), then
 * oldest-waiting tickets from the active set. Caps at 5 total.
 */
export function pickAttentionRows(
  rejections: Array<{
    id: string;
    ticket_no: string;
    asset_name: string;
    created_at: string;
    rejection_reason: string | null;
  }>,
  active: Array<{
    id: string;
    ticket_no: string;
    asset_name: string;
    created_at: string;
  }>,
  now: Date = new Date(),
): AttentionRow[] {
  const ageDays = (createdAt: string) =>
    Math.floor((now.getTime() - new Date(createdAt).getTime()) / 1000 / 3600 / 24);

  const ditolakRows: AttentionRow[] = rejections.map((r) => ({
    id: r.id,
    ticket_no: r.ticket_no,
    asset_name: r.asset_name,
    reason: "ditolak" as const,
    age_days: ageDays(r.created_at),
    rejection_reason: r.rejection_reason,
  }));

  const waitingRows: AttentionRow[] = active
    .filter((t) => ageDays(t.created_at) > 7)
    .sort((a, b) => ageDays(b.created_at) - ageDays(a.created_at))
    .map((t) => ({
      id: t.id,
      ticket_no: t.ticket_no,
      asset_name: t.asset_name,
      reason: "menunggu_lama" as const,
      age_days: ageDays(t.created_at),
      rejection_reason: null,
    }));

  return [...ditolakRows, ...waitingRows].slice(0, 5);
}

/**
 * Per-day approval-rate sparkline for the requester perspective.
 * approvalRate = approved / reviewed, where approved excludes ditolak.
 */
export function buildDailyApprovalRate(
  reviews: Array<{ reviewed_at: string; status: TicketStatus }>,
  days: number,
): SparkPoint[] {
  const buckets = new Map<string, { total: number; approved: number }>();
  for (let i = 0; i < days; i++) {
    buckets.set(isoDate(daysAgo(days - 1 - i)), { total: 0, approved: 0 });
  }
  for (const r of reviews) {
    const key = isoDate(new Date(r.reviewed_at));
    const b = buckets.get(key);
    if (!b) continue;
    b.total++;
    if (r.status !== "ditolak") b.approved++;
  }
  return Array.from(buckets.entries()).map(([date, b]) => ({
    date,
    value: b.total ? b.approved / b.total : 0,
  }));
}

// ─── Main fetcher ──────────────────────────────────────────────────────

export async function fetchPemohonDashboard(
  userId: string,
): Promise<PemohonDashboardData> {
  const supabase = createClient();
  const now = new Date();
  const since30d = daysAgo(30).toISOString();
  const since60d = daysAgo(60).toISOString();
  const since24h = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

  // ─── Q1-Q3 parallel ────────────────────────────────────────────────
  const [
    { data: allTickets60dRaw },
    { data: activeSnapshotRaw },
    { data: recentRejectionsRaw },
  ] = await Promise.all([
    supabase
      .from("disposal_tickets")
      .select(
        "id, ticket_no, asset_name, category, asset_condition, status, rejection_reason, created_at, reviewed_at, completed_at",
      )
      .eq("created_by", userId)
      .gte("created_at", since60d),
    supabase
      .from("disposal_tickets")
      .select("id, ticket_no, asset_name, status, created_at")
      .eq("created_by", userId)
      .in("status", ["menunggu_semakan", "proses_pelupusan"] as TicketStatus[])
      .order("created_at", { ascending: true }),
    supabase
      .from("disposal_tickets")
      .select(
        "id, ticket_no, asset_name, status, created_at, reviewed_at, rejection_reason",
      )
      .eq("created_by", userId)
      .eq("status", "ditolak" as TicketStatus)
      .order("reviewed_at", { ascending: false })
      .limit(10),
  ]);

  const allTickets60d = (allTickets60dRaw ?? []) as Array<{
    id: string;
    ticket_no: string;
    asset_name: string;
    category: AssetCategory | null;
    asset_condition: AssetCondition;
    status: TicketStatus;
    rejection_reason: string | null;
    created_at: string;
    reviewed_at: string | null;
    completed_at: string | null;
  }>;
  const activeSnapshot = (activeSnapshotRaw ?? []) as Array<{
    id: string;
    ticket_no: string;
    asset_name: string;
    status: TicketStatus;
    created_at: string;
  }>;
  const recentRejections = (recentRejectionsRaw ?? []) as Array<{
    id: string;
    ticket_no: string;
    asset_name: string;
    status: TicketStatus;
    created_at: string;
    reviewed_at: string | null;
    rejection_reason: string | null;
  }>;

  // ─── Q4: audit feed for MY tickets (two-step) ──────────────────────
  const myTicketIds = allTickets60d.map((t) => t.id);
  const auditQueryResult = myTicketIds.length
    ? await supabase
        .from("audit_logs")
        .select("id, action, ticket_id, performed_by, created_at")
        .in("ticket_id", myTicketIds)
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(8)
    : { data: [] as Array<{ id: string; action: string; ticket_id: string; performed_by: string; created_at: string }> };
  const audit = (auditQueryResult.data ?? []) as Array<{
    id: string;
    action: string;
    ticket_id: string;
    performed_by: string;
    created_at: string;
  }>;

  // ─── KPI 1: activeCount ────────────────────────────────────────────
  const activeCount = activeSnapshot.length;

  // ─── KPI 2: approved30d ────────────────────────────────────────────
  const reviewed = allTickets60d.filter((t) => t.reviewed_at !== null);
  const reviewed30d = reviewed.filter((t) => t.reviewed_at! >= since30d);
  const reviewed60_30d = reviewed.filter(
    (t) => t.reviewed_at! >= since60d && t.reviewed_at! < since30d,
  );
  const approved30dCurrent = reviewed30d.filter((t) => t.status !== "ditolak").length;
  const approved30dPrior = reviewed60_30d.filter((t) => t.status !== "ditolak").length;
  const approved30d: KpiDelta = {
    current: approved30dCurrent,
    prior: approved30dPrior,
    pctChange: pctChange(approved30dCurrent, approved30dPrior),
  };

  // ─── KPI 3: medianApprovalHours ────────────────────────────────────
  const durations30d = reviewed30d
    .filter((t) => t.status !== "ditolak")
    .map((t) => diffHours(t.reviewed_at!, t.created_at));
  const durations60_30d = reviewed60_30d
    .filter((t) => t.status !== "ditolak")
    .map((t) => diffHours(t.reviewed_at!, t.created_at));
  const medianCurrent = median(durations30d);
  const medianPrior = median(durations60_30d);
  const medianApprovalHours: KpiDelta = {
    current: medianCurrent,
    prior: medianPrior,
    pctChange: pctChange(medianCurrent, medianPrior),
  };

  // ─── KPI 4: approvalRate ───────────────────────────────────────────
  const rateCurrent = reviewed30d.length
    ? approved30dCurrent / reviewed30d.length
    : 0;
  const ratePrior = reviewed60_30d.length
    ? approved30dPrior / reviewed60_30d.length
    : 0;
  const approvalRate: KpiDelta = {
    current: rateCurrent,
    prior: ratePrior,
    pctChange: pctChange(rateCurrent, ratePrior),
  };

  // ─── Sparklines (per-day, last 30d) ────────────────────────────────
  const approvedSparkline = buildDailySeries(
    reviewed30d
      .filter((t) => t.status !== "ditolak")
      .map((t) => t.reviewed_at!),
    30,
  );
  const medianSparkline = buildDailyMedian(
    reviewed30d
      .filter((t) => t.status !== "ditolak")
      .map((t) => ({ created_at: t.created_at, reviewed_at: t.reviewed_at! })),
    30,
  );
  const approvalRateSparkline = buildDailyApprovalRate(
    reviewed30d.map((t) => ({ reviewed_at: t.reviewed_at!, status: t.status })),
    30,
  );

  // ─── Workflow (intake vs completed, 30d) ───────────────────────────
  const intake30d = allTickets60d
    .filter((t) => t.created_at >= since30d)
    .map((t) => ({ created_at: t.created_at }));
  const completed30d = allTickets60d
    .filter((t) => t.completed_at !== null && t.completed_at! >= since30d)
    .map((t) => ({ reviewed_at: t.completed_at! }));
  const workflow = buildDualLine(intake30d, completed30d, 30);

  // ─── statusBreakdown (4 buckets — colors filled in by component) ───
  const statusCounts = { menunggu_semakan: 0, proses_pelupusan: 0, selesai: 0, ditolak: 0 };
  for (const t of allTickets60d) {
    statusCounts[t.status]++;
  }
  const statusBreakdown = [
    { name: "Menunggu", value: statusCounts.menunggu_semakan, color: "" },
    { name: "Proses",   value: statusCounts.proses_pelupusan, color: "" },
    { name: "Selesai",  value: statusCounts.selesai,          color: "" },
    { name: "Ditolak",  value: statusCounts.ditolak,          color: "" },
  ];

  // ─── approvalDuration histogram ────────────────────────────────────
  const approvalDuration = {
    buckets: bucketDurations(durations30d),
    medianHours: medianCurrent,
  };

  // ─── categoryMix (incoming 30d) ────────────────────────────────────
  const categoryMix: CategoryMix = {
    harta_modal_rosak: 0,
    harta_modal_usang: 0,
    aset_rendah_rosak: 0,
    aset_rendah_usang: 0,
    tidak_dinyatakan: 0,
  };
  for (const t of allTickets60d.filter((x) => x.created_at >= since30d)) {
    if (!t.category) {
      categoryMix.tidak_dinyatakan++;
      continue;
    }
    const key =
      `${t.category === "harta_modal" ? "harta_modal" : "aset_rendah"}_${t.asset_condition}` as keyof CategoryMix;
    categoryMix[key]++;
  }

  // ─── attentionRows ─────────────────────────────────────────────────
  const attentionRows = pickAttentionRows(
    recentRejections.map((r) => ({
      id: r.id,
      ticket_no: r.ticket_no,
      asset_name: r.asset_name,
      created_at: r.created_at,
      rejection_reason: r.rejection_reason,
    })),
    activeSnapshot.map((t) => ({
      id: t.id,
      ticket_no: t.ticket_no,
      asset_name: t.asset_name,
      created_at: t.created_at,
    })),
    now,
  );

  // ─── activityFeed (look up actor names for the audit entries) ──────
  const performerIds = Array.from(new Set(audit.map((a) => a.performed_by)));
  const ticketLookup = new Map(allTickets60d.map((t) => [t.id, t.ticket_no]));

  const profilesResult = performerIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", performerIds)
    : { data: [] as Array<{ id: string; full_name: string }> };
  const nameById = new Map<string, string>(
    ((profilesResult.data ?? []) as Array<{ id: string; full_name: string }>).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  const activityFeed: ActivityEntry[] = audit.map((a) => ({
    id: a.id,
    action: a.action,
    ticket_no: ticketLookup.get(a.ticket_id) ?? "—",
    actor_name: nameById.get(a.performed_by) ?? "—",
    timestamp: a.created_at,
  }));

  // ─── isBrandNewUser (drives Welcome panel) ─────────────────────────
  const isBrandNewUser =
    allTickets60d.length === 0 &&
    activeSnapshot.length === 0 &&
    recentRejections.length === 0;

  return {
    kpis: {
      activeCount,
      approved30d,
      medianApprovalHours,
      approvalRate,
      approvedSparkline,
      medianSparkline,
      approvalRateSparkline,
    },
    workflow,
    statusBreakdown,
    approvalDuration,
    categoryMix,
    attentionRows,
    activityFeed,
    isBrandNewUser,
  };
}
