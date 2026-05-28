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
