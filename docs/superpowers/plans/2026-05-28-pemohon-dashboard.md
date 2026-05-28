# Pemohon Analyst Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy stat-card dashboard for `profile.role === "user"` with an analyst-style dashboard (4 KPIs + 6 widgets) mirroring the unit_aset shape.

**Architecture:** Three phases. Phase 0 is pure refactor (extract shared types, helpers, Section component) that preserves the existing unit_aset dashboard's behavior. Phase 1 builds the pemohon data layer (`fetchPemohonDashboard`) with parallel-query + client-side aggregation. Phase 2 builds the component layer (`PemohonDashboard`, `AttentionTable`). Phase 3 wires routing and verifies.

**Tech Stack:** Next.js 14, Supabase JS (`@supabase/ssr`), Tailwind, Radix UI, Recharts, Vitest, lucide-react.

**Spec reference:** `docs/superpowers/specs/2026-05-28-pemohon-dashboard-design.md` (commit `9789dac`)

---

## Phase 0 — Refactors (Preserve Existing Behavior)

These three tasks change zero behavior — they extract reusable units. All existing 102 vitest tests must stay green throughout.

### Task 1: Extract Shared Types

**Files:**
- Create: `lib/dashboard/types.ts`
- Modify: `lib/dashboard/unit-aset.ts:8-91` (remove the type declarations, import from new file)

- [ ] **Step 1: Create the shared types file**

Write `lib/dashboard/types.ts`:

```ts
import type { AssetCategory } from "@/lib/supabase/types";

export interface KpiDelta {
  current: number;
  prior: number;
  /** Sign-aware percent change. null when prior is 0 (can't divide). */
  pctChange: number | null;
}

export interface SparkPoint {
  date: string; // ISO date (yyyy-mm-dd)
  value: number;
}

export interface AgeBuckets {
  fresh: number;    // 0-3 days
  warm: number;     // 4-7 days
  aging: number;    // 8-14 days
  critical: number; // 15+ days
}

export interface HistogramBucket {
  label: string;
  count: number;
}

export interface CategoryMix {
  harta_modal_rosak: number;
  harta_modal_usang: number;
  aset_rendah_rosak: number;
  aset_rendah_usang: number;
  tidak_dinyatakan: number;
}

export interface LocationCount {
  location: string;
  count: number;
}

export interface PendingQueueRow {
  id: string;
  ticket_no: string;
  asset_name: string;
  requester_name: string;
  age_days: number;
  category: AssetCategory | null;
}

export interface ActivityEntry {
  id: string;
  action: string;
  ticket_no: string;
  actor_name: string;
  timestamp: string; // ISO
}

export interface DailyFlow {
  date: string; // yyyy-mm-dd
  intake: number;
  reviewed: number;
}
```

- [ ] **Step 2: Strip types from unit-aset.ts and import from types.ts**

In `lib/dashboard/unit-aset.ts`, replace the type declaration block (lines 1-91) with:

```ts
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

// Re-export for back-compat with any external imports (none expected, but cheap).
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
```

Leave the `UnitAsetDashboardData` interface and everything below unchanged.

- [ ] **Step 3: Run vitest — verify all 102 tests still pass**

Run: `cd /d/project/i-smartlupus-medi && npx vitest run`
Expected: `Tests: 102 passed (102)`

- [ ] **Step 4: Run next build — verify type-check passes**

Run: `npx next build`
Expected: Build succeeds. No type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/types.ts lib/dashboard/unit-aset.ts
git commit -m "refactor(dashboard): extract shared types to lib/dashboard/types.ts

Pure refactor in preparation for pemohon dashboard. All 9 dashboard
types moved out of unit-aset.ts; re-exported for back-compat. Tests
green, build green."
```

---

### Task 2: Extract Shared Helpers

**Files:**
- Create: `lib/dashboard/helpers.ts`
- Modify: `lib/dashboard/unit-aset.ts:95-150,408-486` (move helpers; re-export for back-compat)
- Modify: `lib/dashboard/unit-aset.test.ts:1-7` (update imports)

- [ ] **Step 1: Create helpers.ts with pure utility functions**

Write `lib/dashboard/helpers.ts`:

```ts
import type { SparkPoint, AgeBuckets, HistogramBucket, DailyFlow } from "./types";
import type { TicketStatus } from "@/lib/supabase/types";

// ─── Pure math ──────────────────────────────────────────────────────────

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

// ─── Bucketers ──────────────────────────────────────────────────────────

export function bucketAge(daysOld: number): keyof AgeBuckets {
  if (daysOld <= 3) return "fresh";
  if (daysOld <= 7) return "warm";
  if (daysOld <= 14) return "aging";
  return "critical";
}

const DURATION_BUCKETS: { label: string; max: number }[] = [
  { label: "0-1j", max: 1 },
  { label: "1-2j", max: 2 },
  { label: "2-4j", max: 4 },
  { label: "4-8j", max: 8 },
  { label: "8-16j", max: 16 },
  { label: "16-24j", max: 24 },
  { label: "24j+", max: Infinity },
];

export function bucketDurations(hours: number[]): HistogramBucket[] {
  return DURATION_BUCKETS.map(({ label, max }, i) => {
    const min = i === 0 ? 0 : DURATION_BUCKETS[i - 1].max;
    const count = hours.filter((h) => h >= min && h < max).length;
    return { label, count };
  });
}

// ─── Date helpers ───────────────────────────────────────────────────────

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function diffHours(later: string, earlier: string): number {
  return (new Date(later).getTime() - new Date(earlier).getTime()) / 1000 / 3600;
}

export function diffDays(later: Date, earlier: string): number {
  return (later.getTime() - new Date(earlier).getTime()) / 1000 / 3600 / 24;
}

// ─── Series builders ────────────────────────────────────────────────────

export function buildDailySeries(timestamps: string[], days: number): SparkPoint[] {
  const counts = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    counts.set(isoDate(daysAgo(days - 1 - i)), 0);
  }
  for (const ts of timestamps) {
    const key = isoDate(new Date(ts));
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([date, value]) => ({ date, value }));
}

export function buildDailyMedian(
  reviews: Array<{ created_at: string; reviewed_at: string }>,
  days: number,
): SparkPoint[] {
  const bucketHours = new Map<string, number[]>();
  for (let i = 0; i < days; i++) {
    bucketHours.set(isoDate(daysAgo(days - 1 - i)), []);
  }
  for (const r of reviews) {
    const key = isoDate(new Date(r.reviewed_at));
    if (bucketHours.has(key)) {
      bucketHours.get(key)!.push(diffHours(r.reviewed_at, r.created_at));
    }
  }
  return Array.from(bucketHours.entries()).map(([date, hrs]) => ({
    date,
    value: median(hrs),
  }));
}

export function buildDailyRejectionRate(
  reviews: Array<{ reviewed_at: string; status: TicketStatus }>,
  days: number,
): SparkPoint[] {
  const buckets = new Map<string, { total: number; rejected: number }>();
  for (let i = 0; i < days; i++) {
    buckets.set(isoDate(daysAgo(days - 1 - i)), { total: 0, rejected: 0 });
  }
  for (const r of reviews) {
    const key = isoDate(new Date(r.reviewed_at));
    const b = buckets.get(key);
    if (!b) continue;
    b.total++;
    if (r.status === "ditolak") b.rejected++;
  }
  return Array.from(buckets.entries()).map(([date, b]) => ({
    date,
    value: b.total ? b.rejected / b.total : 0,
  }));
}

export function buildDualLine(
  intake: Array<{ created_at: string }>,
  reviews: Array<{ reviewed_at: string }>,
  days: number,
): DailyFlow[] {
  const intakeCounts = new Map<string, number>();
  const reviewCounts = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const key = isoDate(daysAgo(days - 1 - i));
    intakeCounts.set(key, 0);
    reviewCounts.set(key, 0);
  }
  for (const r of intake) {
    const key = isoDate(new Date(r.created_at));
    if (intakeCounts.has(key)) intakeCounts.set(key, intakeCounts.get(key)! + 1);
  }
  for (const r of reviews) {
    const key = isoDate(new Date(r.reviewed_at));
    if (reviewCounts.has(key)) reviewCounts.set(key, reviewCounts.get(key)! + 1);
  }
  return Array.from(intakeCounts.keys()).map((date) => ({
    date,
    intake: intakeCounts.get(date) ?? 0,
    reviewed: reviewCounts.get(date) ?? 0,
  }));
}
```

- [ ] **Step 2: Strip helpers from unit-aset.ts; import from helpers.ts**

In `lib/dashboard/unit-aset.ts`:
- Delete the function bodies of `median`, `pctChange`, `bucketAge`, `bucketDurations` (lines ~95-132)
- Delete the function bodies of `isoDate`, `daysAgo`, `diffHours`, `diffDays` (lines ~134-150)
- Delete the function bodies of `buildDailySeries`, `buildDailyMedian`, `buildDailyRejectionRate`, `buildDualLine` (lines ~408-486)
- Add imports near the top (after type imports):

```ts
import {
  median,
  pctChange,
  bucketAge,
  bucketDurations,
  isoDate,
  daysAgo,
  diffHours,
  diffDays,
  buildDailySeries,
  buildDailyMedian,
  buildDailyRejectionRate,
  buildDualLine,
} from "./helpers";

// Re-export the helpers tested by unit-aset.test.ts (back-compat — tests import from unit-aset).
export {
  median,
  pctChange,
  bucketAge,
  bucketDurations,
};
```

The remaining content (`fetchUnitAsetDashboard` function body and the type re-exports from Task 1) stays unchanged.

- [ ] **Step 3: Run vitest — verify all 102 tests still pass**

Run: `npx vitest run`
Expected: `Tests: 102 passed (102)` — including `unit-aset.test.ts` which imports the helpers from `unit-aset.ts` (re-exported).

- [ ] **Step 4: Run next build**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/helpers.ts lib/dashboard/unit-aset.ts
git commit -m "refactor(dashboard): extract shared helpers to lib/dashboard/helpers.ts

Pure refactor — median, pctChange, bucketAge, bucketDurations, date
utilities, and series builders moved out of unit-aset.ts. Re-exported
for back-compat with unit-aset.test.ts. Tests green, build green."
```

---

### Task 3: Extract Section Component

**Files:**
- Create: `components/dashboards/Section.tsx`
- Modify: `components/dashboards/UnitAsetDashboard.tsx:41-67` (remove inline Section; import from new file)

- [ ] **Step 1: Create the Section component file**

Write `components/dashboards/Section.tsx`:

```tsx
import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function Section({ title, subtitle, children, className = "" }: SectionProps) {
  return (
    <section
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5 ${className}`}
    >
      <header className="mb-3">
        <h3 className="text-subhead font-semibold text-[var(--fg)] tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-caption text-[var(--fg-muted)] mt-0.5">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Remove inline Section from UnitAsetDashboard; import from new file**

In `components/dashboards/UnitAsetDashboard.tsx`:
- Delete the inline `function Section(...)` block (lines 41-67 in current HEAD)
- Add this import near the other component imports (around line 27):

```ts
import { Section } from "./Section";
```

Leave all `<Section ...>` usages in the JSX unchanged.

- [ ] **Step 3: Run vitest — verify all 102 tests still pass**

Run: `npx vitest run`
Expected: `Tests: 102 passed (102)`

- [ ] **Step 4: Visual smoke (manual)**

Start dev server: `npx next dev`
Log in as a unit_aset test user (IC `770202021234`). Navigate to `/dashboard`. Verify the dashboard renders identically to before (no missing borders, titles, subtitles on widget sections).

If `next dev` is already running from elsewhere, hot-reload should suffice — refresh the page.

- [ ] **Step 5: Commit**

```bash
git add components/dashboards/Section.tsx components/dashboards/UnitAsetDashboard.tsx
git commit -m "refactor(dashboard): extract Section to shared component

Pure refactor — Section card wrapper moved from inline in
UnitAsetDashboard.tsx to components/dashboards/Section.tsx so it can be
reused by the upcoming PemohonDashboard (and admin dashboard later)."
```

---

## Phase 1 — Data Layer

### Task 4: Pemohon Pure Helpers + Tests

**Files:**
- Create: `lib/dashboard/pemohon.ts` (initial — just helpers + types, no fetcher yet)
- Create: `lib/dashboard/pemohon.test.ts`

Pure helpers tested in isolation; the wired fetcher follows in Task 5.

- [ ] **Step 1: Scaffold pemohon.ts with types + 2 pure helpers**

Write `lib/dashboard/pemohon.ts`:

```ts
import { createClient } from "@/lib/supabase/client";
import type { TicketStatus } from "@/lib/supabase/types";
import type {
  KpiDelta,
  SparkPoint,
  HistogramBucket,
  CategoryMix,
  ActivityEntry,
  DailyFlow,
} from "./types";
import { isoDate, daysAgo } from "./helpers";

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
 * Ditolak rows are prioritized (most recent first), then oldest-waiting
 * tickets from the active set. Caps at 5 total.
 *
 * Why: pemohon needs to see what needs their attention. Rejected tickets
 * are the most actionable (require revision); long-waiting tickets are
 * informational (still in queue).
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
 * Empty days return 0.
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

// ─── Main fetcher (added in Task 5) ────────────────────────────────────

// (placeholder — Task 5 implements fetchPemohonDashboard)
```

- [ ] **Step 2: Write pemohon.test.ts — RED**

Write `lib/dashboard/pemohon.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickAttentionRows, buildDailyApprovalRate } from "./pemohon";

describe("pickAttentionRows", () => {
  const now = new Date("2026-05-28T10:00:00.000Z");

  it("returns empty array when no rejections and no active tickets", () => {
    expect(pickAttentionRows([], [], now)).toEqual([]);
  });

  it("prioritizes ditolak rows first, then long-waiting active", () => {
    const rejections = [
      {
        id: "r1",
        ticket_no: "TIC-001",
        asset_name: "Komputer",
        created_at: "2026-05-20T00:00:00Z",
        rejection_reason: "Foto tidak jelas",
      },
    ];
    const active = [
      // 12 days old → menunggu_lama
      { id: "a1", ticket_no: "TIC-002", asset_name: "Pencetak", created_at: "2026-05-16T00:00:00Z" },
      // 3 days old → not menunggu_lama, filtered out
      { id: "a2", ticket_no: "TIC-003", asset_name: "Skanner", created_at: "2026-05-25T00:00:00Z" },
    ];
    const result = pickAttentionRows(rejections, active, now);
    expect(result.length).toBe(2);
    expect(result[0].reason).toBe("ditolak");
    expect(result[0].rejection_reason).toBe("Foto tidak jelas");
    expect(result[1].reason).toBe("menunggu_lama");
    expect(result[1].ticket_no).toBe("TIC-002");
  });

  it("caps total at 5 rows", () => {
    const rejections = Array.from({ length: 4 }, (_, i) => ({
      id: `r${i}`,
      ticket_no: `TIC-R${i}`,
      asset_name: `Reject ${i}`,
      created_at: "2026-05-20T00:00:00Z",
      rejection_reason: "reason",
    }));
    const active = Array.from({ length: 4 }, (_, i) => ({
      id: `a${i}`,
      ticket_no: `TIC-A${i}`,
      asset_name: `Active ${i}`,
      created_at: "2026-05-10T00:00:00Z", // 18 days → menunggu_lama
    }));
    const result = pickAttentionRows(rejections, active, now);
    expect(result.length).toBe(5);
    expect(result.filter((r) => r.reason === "ditolak").length).toBe(4);
    expect(result.filter((r) => r.reason === "menunggu_lama").length).toBe(1);
  });

  it("sorts menunggu_lama by age descending (oldest first)", () => {
    const active = [
      { id: "a1", ticket_no: "TIC-NEW", asset_name: "Newer", created_at: "2026-05-18T00:00:00Z" }, // 10d
      { id: "a2", ticket_no: "TIC-OLD", asset_name: "Older", created_at: "2026-05-10T00:00:00Z" }, // 18d
    ];
    const result = pickAttentionRows([], active, now);
    expect(result[0].ticket_no).toBe("TIC-OLD");
    expect(result[1].ticket_no).toBe("TIC-NEW");
  });

  it("excludes active tickets younger than 8 days", () => {
    const active = [
      { id: "a1", ticket_no: "TIC-YOUNG", asset_name: "Young", created_at: "2026-05-25T00:00:00Z" }, // 3d
    ];
    expect(pickAttentionRows([], active, now)).toEqual([]);
  });
});

describe("buildDailyApprovalRate", () => {
  it("returns N days of zero rate when no reviews", () => {
    const result = buildDailyApprovalRate([], 7);
    expect(result.length).toBe(7);
    expect(result.every((p) => p.value === 0)).toBe(true);
  });

  it("computes per-day approval rate excluding ditolak from numerator", () => {
    // Use today's date for the test data
    const today = new Date();
    const isoDate = (d: Date) => d.toISOString().slice(0, 10);
    const todayIso = isoDate(today);
    const reviews = [
      { reviewed_at: `${todayIso}T10:00:00Z`, status: "selesai" as const },
      { reviewed_at: `${todayIso}T11:00:00Z`, status: "proses_pelupusan" as const },
      { reviewed_at: `${todayIso}T12:00:00Z`, status: "ditolak" as const },
    ];
    const result = buildDailyApprovalRate(reviews, 1);
    expect(result[0].value).toBeCloseTo(2 / 3, 5);
  });
});
```

- [ ] **Step 3: Run vitest — verify 5 new tests in pemohon.test.ts pass; old 102 still pass**

Run: `npx vitest run`
Expected: `Tests: 109 passed (109)` — 102 prior + 7 new (5 for pickAttentionRows + 2 for buildDailyApprovalRate).

- [ ] **Step 4: Run next build**

Run: `npx next build`
Expected: Build succeeds. No type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/pemohon.ts lib/dashboard/pemohon.test.ts
git commit -m "feat(dashboard): pemohon pure helpers + types

Add pickAttentionRows + buildDailyApprovalRate as pure helpers
(testable without Supabase), plus PemohonDashboardData type. Fetcher
implementation follows in next task."
```

---

### Task 5: Implement `fetchPemohonDashboard` (Query Plan + Aggregation)

**Files:**
- Modify: `lib/dashboard/pemohon.ts` (add `fetchPemohonDashboard` function)

Mirrors `fetchUnitAsetDashboard` shape from `lib/dashboard/unit-aset.ts:152-404`. No unit tests on the fetcher itself — matches the unit_aset convention (the fetcher wires queries to pure helpers, which are tested separately). Smoke-tested in Task 11.

- [ ] **Step 1: Add fetcher imports**

Edit `lib/dashboard/pemohon.ts` — replace the existing top imports block with:

```ts
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
```

- [ ] **Step 2: Append the fetcher to pemohon.ts**

Replace the trailing placeholder comment with the full fetcher implementation:

```ts
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
  const { data: auditRaw } = myTicketIds.length
    ? await supabase
        .from("audit_logs")
        .select("id, action, ticket_id, performed_by, created_at")
        .in("ticket_id", myTicketIds)
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(8)
    : { data: [] as Array<{ id: string; action: string; ticket_id: string; performed_by: string; created_at: string }> };
  const audit = (auditRaw ?? []) as Array<{
    id: string;
    action: string;
    ticket_id: string;
    performed_by: string;
    created_at: string;
  }>;

  // ─── KPI 1: activeCount ────────────────────────────────────────────
  const activeCount = activeSnapshot.length;

  // ─── KPI 2: approved30d (reviewed last 30d, status != ditolak) ─────
  const reviewed = allTickets60d.filter((t) => t.reviewed_at !== null);
  const reviewed30d = reviewed.filter(
    (t) => t.reviewed_at! >= since30d,
  );
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

  // ─── KPI 3: medianApprovalHours (last 30d vs prior 30d) ────────────
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

  // ─── KPI 4: approvalRate (approved / reviewed) ─────────────────────
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

  // ─── statusBreakdown (4 buckets, palette neutral — UI passes colors) ─
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
  // Note: `color` is filled in by PemohonDashboard.tsx from chartColors(resolvedTheme).

  // ─── approvalDuration histogram (last 30d approved tickets) ────────
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

  const { data: profilesData } = performerIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", performerIds)
    : { data: [] as Array<{ id: string; full_name: string }> };
  const nameById = new Map<string, string>(
    ((profilesData ?? []) as Array<{ id: string; full_name: string }>).map((p) => [
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

  // ─── isBrandNewUser (drives Welcome panel zero state) ──────────────
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
```

- [ ] **Step 3: Run vitest — verify all tests still pass**

Run: `npx vitest run`
Expected: `Tests: 109 passed (109)` — fetcher isn't unit-tested but type-checks.

- [ ] **Step 4: Run next build — verify type-check passes**

Run: `npx next build`
Expected: Build succeeds. No type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/pemohon.ts
git commit -m "feat(dashboard): implement fetchPemohonDashboard

3-parallel + 1-followup query plan. Client-side aggregation for 4 KPIs
+ 3 sparklines + workflow + statusBreakdown + approvalDuration +
categoryMix + attentionRows + activityFeed + isBrandNewUser flag.
Mirrors fetchUnitAsetDashboard pattern with requester-perspective
filtering (.eq created_by, userId)."
```

---

## Phase 2 — Component Layer

### Task 6: AttentionTable Component (TDD)

**Files:**
- Create: `components/dashboards/AttentionTable.tsx`
- Create: `components/dashboards/AttentionTable.test.tsx`

- [ ] **Step 1: Look at PendingReviewTable.tsx to match styling**

Run: `cat components/dashboards/PendingReviewTable.tsx | head -60`
Expected: Read the row styling (border, severity dot CSS classes, click handler pattern). Do NOT copy code — just understand the visual idiom so AttentionTable matches.

- [ ] **Step 2: Write AttentionTable.test.tsx — RED**

Write `components/dashboards/AttentionTable.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AttentionTable } from "./AttentionTable";
import type { AttentionRow } from "@/lib/dashboard/pemohon";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

beforeEach(() => {
  pushMock.mockClear();
});

describe("AttentionTable", () => {
  it("renders empty state when rows is empty", () => {
    render(<AttentionTable rows={[]} />);
    expect(screen.getByText(/tiada permohonan memerlukan perhatian/i)).toBeInTheDocument();
  });

  it("renders rose-toned severity dot for ditolak rows", () => {
    const rows: AttentionRow[] = [
      {
        id: "t1",
        ticket_no: "TIC-001",
        asset_name: "Komputer Riba",
        reason: "ditolak",
        age_days: 5,
        rejection_reason: "Foto tidak jelas",
      },
    ];
    const { container } = render(<AttentionTable rows={rows} />);
    expect(container.querySelector('[data-severity="ditolak"]')).not.toBeNull();
  });

  it("renders amber-toned severity dot for menunggu_lama rows", () => {
    const rows: AttentionRow[] = [
      {
        id: "t2",
        ticket_no: "TIC-002",
        asset_name: "Pencetak",
        reason: "menunggu_lama",
        age_days: 12,
        rejection_reason: null,
      },
    ];
    const { container } = render(<AttentionTable rows={rows} />);
    expect(container.querySelector('[data-severity="menunggu_lama"]')).not.toBeNull();
  });

  it("renders rejection_reason text for ditolak rows", () => {
    const rows: AttentionRow[] = [
      {
        id: "t3",
        ticket_no: "TIC-003",
        asset_name: "Mesin Faks",
        reason: "ditolak",
        age_days: 5,
        rejection_reason: "Sila lampirkan invois pembelian",
      },
    ];
    render(<AttentionTable rows={rows} />);
    expect(screen.getByText(/sila lampirkan invois pembelian/i)).toBeInTheDocument();
  });

  it("renders 'Menunggu N hari' text for menunggu_lama rows", () => {
    const rows: AttentionRow[] = [
      {
        id: "t4",
        ticket_no: "TIC-004",
        asset_name: "Skanner",
        reason: "menunggu_lama",
        age_days: 14,
        rejection_reason: null,
      },
    ];
    render(<AttentionTable rows={rows} />);
    expect(screen.getByText(/menunggu 14 hari/i)).toBeInTheDocument();
  });

  it("navigates to /semua/${id} when a row is clicked", () => {
    const rows: AttentionRow[] = [
      {
        id: "abc-123",
        ticket_no: "TIC-005",
        asset_name: "Test",
        reason: "ditolak",
        age_days: 5,
        rejection_reason: "reason",
      },
    ];
    render(<AttentionTable rows={rows} />);
    fireEvent.click(screen.getByText("TIC-005"));
    expect(pushMock).toHaveBeenCalledWith("/semua/abc-123");
  });
});
```

- [ ] **Step 3: Run the test — verify it fails**

Run: `npx vitest run components/dashboards/AttentionTable.test.tsx`
Expected: FAIL with "AttentionTable is not defined" or "Cannot find module ./AttentionTable".

- [ ] **Step 4: Write AttentionTable.tsx — minimal impl**

Write `components/dashboards/AttentionTable.tsx`:

```tsx
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
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--surface-hover)] ${
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
              className={`h-2 w-2 rounded-full shrink-0 ${
                row.reason === "ditolak"
                  ? "bg-[var(--severity-critical)]"
                  : "bg-[var(--severity-aging)]"
              }`}
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
```

- [ ] **Step 5: Run the test — verify it passes**

Run: `npx vitest run components/dashboards/AttentionTable.test.tsx`
Expected: `Tests: 6 passed (6)`

- [ ] **Step 6: Run the full suite + build**

Run: `npx vitest run && npx next build`
Expected: `Tests: 115 passed (115)`. Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add components/dashboards/AttentionTable.tsx components/dashboards/AttentionTable.test.tsx
git commit -m "feat(dashboard): AttentionTable widget for pemohon

Purpose-built widget #5 for pemohon dashboard. Two row types (ditolak
+ menunggu_lama) with distinct severity colors but uniform routing to
/semua/\${id} read-only detail. TODO comment placed at click handler
for the future edit/resubmit feature. 6 tests."
```

---

### Task 7: PemohonDashboard Composition

**Files:**
- Create: `components/dashboards/PemohonDashboard.tsx`

- [ ] **Step 1: Implement PemohonDashboard.tsx**

Write `components/dashboards/PemohonDashboard.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  CheckCheck,
  Clock,
  Percent,
  PlusCircle,
} from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { ROLE_LABELS } from "@/lib/constants";
import { getGreeting } from "@/lib/greeting";
import { DashboardSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
import StatusChart from "@/components/StatusChart";
import { useTheme } from "@/components/theme-provider";
import type { Profile } from "@/lib/supabase/types";
import {
  fetchPemohonDashboard,
  type PemohonDashboardData,
} from "@/lib/dashboard/pemohon";
import { Section } from "./Section";
import { KpiCard } from "./KpiCard";
import { DualLineChart } from "./DualLineChart";
import { DurationHistogram } from "./DurationHistogram";
import { NestedDonut } from "./NestedDonut";
import { ActivityFeed } from "./ActivityFeed";
import { AttentionTable } from "./AttentionTable";

interface PemohonDashboardProps {
  profile: Profile;
}

function formatTodayMY(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("ms-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

// Same palette as legacy dashboard (chartColors helper at app/(protected)/dashboard/page.tsx:60).
function chartColors(mode: "light" | "dark") {
  if (mode === "dark") {
    return { menunggu: "#facc15", proses: "#fb923c", selesai: "#34d399", ditolak: "#f87171" };
  }
  return { menunggu: "#eab308", proses: "#f97316", selesai: "#10b981", ditolak: "#ef4444" };
}

export function PemohonDashboard({ profile }: PemohonDashboardProps) {
  const [data, setData] = useState<PemohonDashboardData | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    fetchPemohonDashboard(profile.id).then(setData).catch((err) => {
      console.error("Failed to load pemohon dashboard", err);
    });
  }, [profile.id]);

  if (!data) {
    return (
      <div role="status">
        <DashboardSkeleton />
        <span className="sr-only">Memuatkan papan pemuka...</span>
      </div>
    );
  }

  // Brand-new user (no tickets ever) → Welcome panel
  if (data.isBrandNewUser) {
    return (
      <div className="space-y-6">
        <header className="animate-in">
          <h1 className="text-display font-bold text-[var(--fg)] tracking-tight">
            Selamat datang, {profile.full_name.split(" ")[0]}
          </h1>
          <div className="mt-1.5 flex items-center gap-2 text-footnote text-[var(--fg-muted)]">
            <span>{formatTodayMY()}</span>
            <span aria-hidden>·</span>
            <Chip tone="neutral">{ROLE_LABELS[profile.role]}</Chip>
          </div>
        </header>
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center animate-in [animation-delay:100ms]">
          <Inbox className="h-12 w-12 mx-auto text-[var(--fg-muted)]" aria-hidden />
          <h2 className="mt-4 text-headline font-semibold text-[var(--fg)]">
            Belum ada permohonan
          </h2>
          <p className="mt-2 text-body text-[var(--fg-muted)]">
            Mohon pelupusan pertama anda untuk mula.
          </p>
          <Link
            href="/mohon"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-body font-semibold text-[var(--primary-fg)] shadow-[var(--shadow-tactile)] hover:opacity-90"
          >
            <PlusCircle className="h-5 w-5" aria-hidden />
            Mohon Baru
          </Link>
        </section>
      </div>
    );
  }

  const { kpis } = data;
  const palette = chartColors(resolvedTheme);
  const statusData = data.statusBreakdown.map((b) => ({
    ...b,
    color:
      b.name === "Menunggu" ? palette.menunggu :
      b.name === "Proses"   ? palette.proses   :
      b.name === "Selesai"  ? palette.selesai  :
      palette.ditolak,
  }));

  // Per-widget zero state checks
  const statusTotal = data.statusBreakdown.reduce((sum, b) => sum + b.value, 0);
  const durationTotal = data.approvalDuration.buckets.reduce((sum, b) => sum + b.count, 0);
  const categoryTotal = Object.values(data.categoryMix).reduce((sum, v) => sum + v, 0);

  return (
    <div className="space-y-5">
      {/* Greeting strip */}
      <header className="flex items-start justify-between gap-4 animate-in">
        <div className="min-w-0">
          <h1 className="text-display font-bold text-[var(--fg)] tracking-tight">
            {getGreeting()}, {profile.full_name.split(" ")[0]}
          </h1>
          <div className="mt-1.5 flex items-center gap-2 text-footnote text-[var(--fg-muted)]">
            <span>{formatTodayMY()}</span>
            <span aria-hidden>·</span>
            <Chip tone="neutral">{ROLE_LABELS[profile.role]}</Chip>
          </div>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-in [animation-delay:50ms]">
        <KpiCard
          label="Permohonan Aktif"
          value={kpis.activeCount.toString()}
          tone="emerald"
          icon={ClipboardList}
        />
        <KpiCard
          label="Diluluskan (30h)"
          value={kpis.approved30d.current.toString()}
          tone="amber"
          icon={CheckCheck}
          pctChange={kpis.approved30d.pctChange}
          goodDirection="up"
          spark={kpis.approvedSparkline}
          deltaWindow="vs 30h"
        />
        <KpiCard
          label="Median Masa Kelulusan"
          value={`${kpis.medianApprovalHours.current.toFixed(1)} jam`}
          tone="sky"
          icon={Clock}
          pctChange={kpis.medianApprovalHours.pctChange}
          goodDirection="down"
          spark={kpis.medianSparkline}
          deltaWindow="vs 30h"
        />
        <KpiCard
          label="Kadar Kelulusan"
          value={`${(kpis.approvalRate.current * 100).toFixed(0)}%`}
          tone="violet"
          icon={Percent}
          pctChange={kpis.approvalRate.pctChange}
          goodDirection="up"
          spark={kpis.approvalRateSparkline}
          deltaWindow="vs 30h"
        />
      </div>

      {/* Workflow */}
      <Section
        title="Aliran Permohonan Saya"
        subtitle="Permohonan dihantar vs selesai · 30 hari"
        className="animate-in [animation-delay:100ms]"
      >
        <DualLineChart data={data.workflow} />
      </Section>

      {/* Two-up: status + duration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <Section
          title="Status Permohonan"
          subtitle="Taburan status semua permohonan saya"
          className="animate-in [animation-delay:150ms]"
        >
          {statusTotal === 0 ? (
            <EmptyState
              icon={<Inbox className="h-8 w-8" aria-hidden />}
              title="Belum ada permohonan"
              description="Mohon yang pertama untuk lihat status."
            />
          ) : (
            <StatusChart data={statusData} />
          )}
        </Section>
        <Section
          title="Taburan Masa Kelulusan"
          subtitle="Berapa lama permohonan saya diluluskan · 30 hari"
          className="animate-in [animation-delay:200ms]"
        >
          {durationTotal === 0 ? (
            <EmptyState
              icon={<Inbox className="h-8 w-8" aria-hidden />}
              title="Belum ada permohonan diluluskan"
              description="Data taburan masa akan muncul selepas permohonan pertama diluluskan."
            />
          ) : (
            <DurationHistogram
              buckets={data.approvalDuration.buckets}
              medianHours={data.approvalDuration.medianHours}
            />
          )}
        </Section>
      </div>

      {/* Two-up: category + attention */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <Section
          title="Kategori Aset Saya"
          subtitle="Kategori × keadaan aset · 30 hari"
          className="animate-in [animation-delay:250ms]"
        >
          {categoryTotal === 0 ? (
            <EmptyState
              icon={<Inbox className="h-8 w-8" aria-hidden />}
              title="Belum ada permohonan"
              description="Carta kategori akan muncul selepas permohonan dihantar."
            />
          ) : (
            <NestedDonut mix={data.categoryMix} />
          )}
        </Section>
        <Section
          title="Permohonan Memerlukan Perhatian"
          subtitle="Ditolak (perlu pindaan) atau menunggu lebih 7 hari"
          className="animate-in [animation-delay:300ms]"
        >
          <AttentionTable rows={data.attentionRows} />
        </Section>
      </div>

      {/* Activity feed */}
      <section className="space-y-3 animate-in [animation-delay:350ms]">
        <div className="px-1">
          <h3 className="text-subhead font-semibold text-[var(--fg)] tracking-tight">
            Aktiviti Terkini Saya
          </h3>
          <p className="text-caption text-[var(--fg-muted)] mt-0.5">
            24 jam yang lalu · permohonan saya
          </p>
        </div>
        {data.activityFeed.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-8 w-8" aria-hidden />}
            title="Tiada aktiviti dalam 24 jam terakhir"
            description="Aktiviti pada permohonan anda akan dipaparkan di sini."
          />
        ) : (
          <ActivityFeed entries={data.activityFeed} />
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Run vitest — verify all tests still pass**

Run: `npx vitest run`
Expected: `Tests: 115 passed (115)` — no new tests added (composition tested via smoke), but no regressions.

- [ ] **Step 3: Run next build — verify type-check passes**

Run: `npx next build`
Expected: Build succeeds. Imports resolve. JSX types OK.

- [ ] **Step 4: Commit**

```bash
git add components/dashboards/PemohonDashboard.tsx
git commit -m "feat(dashboard): PemohonDashboard composition

4 KPIs + 6 widgets in 2-column layout, mirroring UnitAsetDashboard
shape. Brand-new-user Welcome panel for the empty case. Per-widget
EmptyState fallbacks for sparse data. Theme-aware StatusChart palette."
```

---

### Task 8: Route Wiring + Full Verification

**Files:**
- Modify: `app/(protected)/dashboard/page.tsx` (add user-role branch)

- [ ] **Step 1: Read current routing**

Run: `grep -n "if (profile.role" "app/(protected)/dashboard/page.tsx"`
Expected output: line ~154 showing `if (profile.role === "unit_aset") { return <UnitAsetDashboard profile={profile} />; }`

- [ ] **Step 2: Add the import**

In `app/(protected)/dashboard/page.tsx`, add to the imports near `UnitAsetDashboard`:

```ts
import { PemohonDashboard } from "@/components/dashboards/PemohonDashboard";
```

- [ ] **Step 3: Add the role branch**

Right after the `if (profile.role === "unit_aset")` block (around line 156), add:

```ts
if (profile.role === "user") {
  return <PemohonDashboard profile={profile} />;
}
```

The legacy stat-card body below stays unchanged — it now only runs for `admin` role.

- [ ] **Step 4: Run vitest — verify all tests still pass**

Run: `npx vitest run`
Expected: `Tests: 115 passed (115)`.

- [ ] **Step 5: Run next build — final type-check + bundle size**

Run: `npx next build`
Expected: Build succeeds. Note the `/dashboard` route size — should not exceed unit_aset's 135kB baseline by more than 30kB (target: < 165kB).

- [ ] **Step 6: Manual smoke checklist**

Start dev server: `npx next dev`

Log in as test user IC `880101011234` (Test User, role=user). If you don't recall the password for this test user, reset it via Supabase Studio (Authentication → Users → find user → "Send password recovery") or via the `/api/register` admin route. The IC-based auth maps to `{ic}@ic.local` for email lookup.

Verify:

- [ ] Dashboard renders analyst layout (NOT legacy stat-cards)
- [ ] 4 KPI cards visible in strip
- [ ] All 6 widgets render
- [ ] AttentionTable shows rows OR EmptyState (depends on seeded data)
- [ ] Clicking an AttentionTable row navigates to `/semua/${id}` (read-only detail)
- [ ] StatusChart shows correct colors in light mode (yellow/orange/emerald/red)
- [ ] Toggle to dark mode via ThemeToggle — StatusChart colors switch to 400-level palette
- [ ] If audit_logs feed is empty for the test user, "Aktiviti Terkini Saya" shows EmptyState (not a crash)
- [ ] Test with another user IC `647256478376` or `841101115314` for cross-account verification

If the audit_logs feed never populates: probe Supabase Studio with the test user's `auth.uid` to confirm RLS allows them to read audit_logs for tickets they own. If RLS denies, file a follow-up to loosen audit_logs RLS for ticket-owners (per spec §7.6 path (a)).

- [ ] **Step 7: Commit the route change**

```bash
git add "app/(protected)/dashboard/page.tsx"
git commit -m "feat(dashboard): route user role to PemohonDashboard

Adds the user-role branch in dashboard/page.tsx. Pemohon now sees the
new analyst dashboard; legacy stat-card layout remains for admin role
pending its own dashboard pass."
```

---

## Summary

**Total tasks**: 8 (3 refactor + 4 feature + 1 wire-up & verify)

**Expected final state:**
- 8 new commits on top of `c50e6e8` (yesterday's seed scripts) — plus 1 already-committed spec at `9789dac`
- 13 new test cases (5 + 2 in pemohon.test.ts; 6 in AttentionTable.test.tsx)
- Total vitest count: 115 (was 102 → 102 + 13)
- `next build` route size for `/dashboard` under 165kB
- User role now sees analyst dashboard; admin role still on legacy

**Divergence from spec § 8.1 (intentional):**
Spec listed 13 fetcher tests with a mocked Supabase client. This plan tests the pure helpers (`pickAttentionRows`, `buildDailyApprovalRate`) only — matching the existing `unit-aset.test.ts` convention which does NOT mock Supabase. Reason: the codebase has no Supabase-client mocking infrastructure today; building one is its own scoped work. The pure helpers cover the genuinely-new pemohon logic; the rest of the fetcher is wiring against helpers already tested in `unit-aset.test.ts` via re-export. Tracked as a follow-up: "Add Supabase mock fixture for dashboard fetcher integration tests."

**Branch / push**: this plan operates on local `master` (already 3 commits ahead of `personal/master`). After verification, push to `personal/master` per the repo convention.

```bash
git push personal master
```
