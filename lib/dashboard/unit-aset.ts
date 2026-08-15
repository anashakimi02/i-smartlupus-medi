import { createClient } from "@/lib/supabase/client";
import type {
  AssetCategory,
  AssetCondition,
  TicketStatus,
} from "@/lib/supabase/types";
import type {
  KpiDelta,
  SparkPoint,
  AgeBuckets,
  HistogramBucket,
  CategoryMix,
  LocationCount,
  PendingQueueRow,
  ActivityEntry,
  DailyFlow,
} from "./types";
import {
  median,
  pctChange,
  bucketAge,
  bucketDurations,
  daysAgo,
  diffHours,
  diffDays,
  buildDailySeries,
  buildDailyMedian,
  buildDailyRejectionRate,
  buildDualLine,
} from "./helpers";

// Re-export types for back-compat with any external imports.
export type {
  KpiDelta,
  SparkPoint,
  AgeBuckets,
  HistogramBucket,
  CategoryMix,
  LocationCount,
  PendingQueueRow,
  ActivityEntry,
  DailyFlow,
};

// Re-export helpers tested by unit-aset.test.ts (back-compat — tests import from here).
export {
  median,
  pctChange,
  bucketAge,
  bucketDurations,
};

export interface UnitAsetDashboardData {
  kpis: {
    queueSize: number;                    // snapshot, no delta
    reviewed7d: KpiDelta;
    medianReviewHours: KpiDelta;
    rejectionRate: KpiDelta;              // 0-1 fraction
    overdueCount: number;                 // snapshot, no delta
    reviewedSparkline: SparkPoint[];      // last 30 days
    medianSparkline: SparkPoint[];        // last 30 days (daily median)
    rejectionSparkline: SparkPoint[];     // last 30 days (daily rejection rate)
  };
  workflow: DailyFlow[]; // 30 days
  ageBuckets: AgeBuckets;
  reviewDuration: {
    buckets: HistogramBucket[];
    medianHours: number;
  };
  categoryMix: CategoryMix;
  topLocations: LocationCount[]; // top 8
  pendingQueue: PendingQueueRow[]; // top 5 oldest
  activityFeed: ActivityEntry[]; // last 8 entries from last 24h
}

// ─── Main fetcher ──────────────────────────────────────────────────────────

export async function fetchUnitAsetDashboard(
  userId: string,
): Promise<UnitAsetDashboardData> {
  const supabase = createClient();
  const now = new Date();
  const since7d = daysAgo(7).toISOString();
  const since14d = daysAgo(14).toISOString();
  const since30d = daysAgo(30).toISOString();
  const since60d = daysAgo(60).toISOString();
  const since24h = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

  // Parallel queries
  const [
    { data: pendingRaw },
    { data: myReviews60d },
    { data: intake30d },
    { data: incoming30dDetail },
    { data: pendingQueueRaw },
    { data: auditRaw },
  ] = await Promise.all([
    supabase
      .from("disposal_tickets")
      .select("id, created_at")
      .eq("status", "menunggu_semakan" as TicketStatus),
    supabase
      .from("disposal_tickets")
      .select("created_at, reviewed_at, status")
      .eq("reviewed_by", userId)
      .gte("reviewed_at", since60d)
      .not("reviewed_at", "is", null),
    supabase
      .from("disposal_tickets")
      .select("created_at")
      .gte("created_at", since30d),
    supabase
      .from("disposal_tickets")
      .select("category, asset_condition, location")
      .gte("created_at", since30d),
    supabase
      .from("disposal_tickets")
      .select("id, ticket_no, asset_type, category, created_at, created_by")
      .eq("status", "menunggu_semakan" as TicketStatus)
      .order("created_at", { ascending: true })
      .limit(5),
    supabase
      .from("audit_logs")
      .select("id, action, ticket_id, performed_by, created_at")
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  // ─── KPI: queue snapshot + age buckets + overdue ──
  const pending = pendingRaw ?? [];
  const queueSize = pending.length;
  const ageBuckets: AgeBuckets = { fresh: 0, warm: 0, aging: 0, critical: 0 };
  let overdueCount = 0;
  for (const p of pending) {
    const ageDays = diffDays(now, p.created_at);
    ageBuckets[bucketAge(ageDays)]++;
    if (ageDays > 7) overdueCount++;
  }

  // ─── KPI: reviewed deltas + sparklines ──
  const reviews = (myReviews60d ?? []) as Array<{
    created_at: string;
    reviewed_at: string;
    status: TicketStatus;
  }>;
  const reviews7d = reviews.filter((r) => r.reviewed_at >= since7d);
  const reviews14_7d = reviews.filter(
    (r) => r.reviewed_at >= since14d && r.reviewed_at < since7d,
  );
  const reviews30d = reviews.filter((r) => r.reviewed_at >= since30d);
  const reviews60_30d = reviews.filter(
    (r) => r.reviewed_at >= since60d && r.reviewed_at < since30d,
  );

  const reviewed7d: KpiDelta = {
    current: reviews7d.length,
    prior: reviews14_7d.length,
    pctChange: pctChange(reviews7d.length, reviews14_7d.length),
  };

  // ─── KPI: median review time (last 30d vs 60-30d prior) ──
  const durations30d = reviews30d.map((r) =>
    diffHours(r.reviewed_at, r.created_at),
  );
  const durations60_30d = reviews60_30d.map((r) =>
    diffHours(r.reviewed_at, r.created_at),
  );
  const medianCurrent = median(durations30d);
  const medianPrior = median(durations60_30d);
  const medianReviewHours: KpiDelta = {
    current: medianCurrent,
    prior: medianPrior,
    pctChange: pctChange(medianCurrent, medianPrior),
  };

  // ─── KPI: rejection rate (last 30d vs prior) ──
  const rejected30d = reviews30d.filter((r) => r.status === "ditolak").length;
  const rate30d = reviews30d.length ? rejected30d / reviews30d.length : 0;
  const rejected60_30d = reviews60_30d.filter((r) => r.status === "ditolak").length;
  const ratePrior = reviews60_30d.length ? rejected60_30d / reviews60_30d.length : 0;
  const rejectionRate: KpiDelta = {
    current: rate30d,
    prior: ratePrior,
    pctChange: pctChange(rate30d, ratePrior),
  };

  // ─── Sparklines (per-day for last 30 days) ──
  const reviewedSparkline = buildDailySeries(
    reviews30d.map((r) => r.reviewed_at),
    30,
  );
  const medianSparkline = buildDailyMedian(reviews30d, 30);
  const rejectionSparkline = buildDailyRejectionRate(reviews30d, 30);

  // ─── Dual-line workflow ──
  const intakeRows = (intake30d ?? []) as Array<{ created_at: string }>;
  const workflow = buildDualLine(intakeRows, reviews30d, 30);

  // ─── Histogram (review duration) ──
  const reviewDuration = {
    buckets: bucketDurations(durations30d),
    medianHours: medianCurrent,
  };

  // ─── Category mix ──
  const incoming = (incoming30dDetail ?? []) as Array<{
    category: AssetCategory | null;
    asset_condition: AssetCondition;
    location: string | null;
  }>;
  const categoryMix: CategoryMix = {
    harta_modal_rosak: 0,
    harta_modal_usang: 0,
    aset_rendah_rosak: 0,
    aset_rendah_usang: 0,
    tidak_dinyatakan: 0,
  };
  for (const row of incoming) {
    if (!row.category) {
      categoryMix.tidak_dinyatakan++;
      continue;
    }
    const key =
      `${row.category === "harta_modal" ? "harta_modal" : "aset_rendah"}_${row.asset_condition}` as keyof CategoryMix;
    categoryMix[key]++;
  }

  // ─── Top locations ──
  const locCounts = new Map<string, number>();
  for (const row of incoming) {
    const loc = row.location?.trim() || "Tiada Lokasi";
    locCounts.set(loc, (locCounts.get(loc) ?? 0) + 1);
  }
  const topLocations: LocationCount[] = Array.from(locCounts.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ─── Pending queue with names ──
  const pendingRows = (pendingQueueRaw ?? []) as Array<{
    id: string;
    ticket_no: string;
    asset_type: string;
    category: AssetCategory | null;
    created_at: string;
    created_by: string | null;
  }>;

  // Null actors (owner hard-deleted, migration 008) must not reach the id
  // list — it feeds .in("id", …) on a UUID column, where one null breaks the
  // lookup for every row, not just the orphaned one.
  const userIds = new Set<string>();
  for (const row of pendingRows) if (row.created_by) userIds.add(row.created_by);

  // Audit feed actor + ticket lookups
  const audit = (auditRaw ?? []) as Array<{
    id: string;
    action: string;
    ticket_id: string;
    performed_by: string | null;
    created_at: string;
  }>;
  const ticketIds = new Set<string>();
  for (const a of audit) {
    if (a.performed_by) userIds.add(a.performed_by);
    ticketIds.add(a.ticket_id);
  }

  const [{ data: profilesData }, { data: ticketsData }] = await Promise.all([
    userIds.size
      ? supabase.from("profiles").select("id, full_name").in("id", Array.from(userIds))
      : Promise.resolve({ data: [] }),
    ticketIds.size
      ? supabase
          .from("disposal_tickets")
          .select("id, ticket_no")
          .in("id", Array.from(ticketIds))
      : Promise.resolve({ data: [] }),
  ]);

  const nameById = new Map<string, string>(
    ((profilesData ?? []) as Array<{ id: string; full_name: string }>).map((p) => [
      p.id,
      p.full_name,
    ]),
  );
  const ticketNoById = new Map<string, string>(
    ((ticketsData ?? []) as Array<{ id: string; ticket_no: string }>).map((t) => [
      t.id,
      t.ticket_no,
    ]),
  );

  const pendingQueue: PendingQueueRow[] = pendingRows.map((row) => ({
    id: row.id,
    ticket_no: row.ticket_no,
    asset_name: row.asset_type,
    requester_name: (row.created_by && nameById.get(row.created_by)) || "—",
    age_days: Math.floor(diffDays(now, row.created_at)),
    category: row.category,
  }));

  const activityFeed: ActivityEntry[] = audit.map((a) => ({
    id: a.id,
    action: a.action,
    ticket_no: ticketNoById.get(a.ticket_id) ?? "—",
    actor_name: (a.performed_by && nameById.get(a.performed_by)) || "—",
    timestamp: a.created_at,
  }));

  return {
    kpis: {
      queueSize,
      reviewed7d,
      medianReviewHours,
      rejectionRate,
      overdueCount,
      reviewedSparkline,
      medianSparkline,
      rejectionSparkline,
    },
    workflow,
    ageBuckets,
    reviewDuration,
    categoryMix,
    topLocations,
    pendingQueue,
    activityFeed,
  };
}

