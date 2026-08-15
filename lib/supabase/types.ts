export type UserRole = "user" | "unit_aset" | "admin";

export type AssetCondition = "rosak" | "usang";

export type AssetCategory = "harta_modal" | "aset_bernilai_rendah";

export type AssetSubCategory = "alat_perubatan" | "bukan_alat_perubatan";

export type TicketStatus =
  | "menunggu_semakan"
  | "proses_pelupusan"
  | "selesai"
  | "ditolak";

export type DisposalMethod = "jualan" | "lelong" | "musnah" | "serah_agensi";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  unit_name: string | null;
  created_at: string;
  is_active: boolean;
}

export interface DisposalTicket {
  id: string;
  ticket_no: string;
  asset_condition: AssetCondition;
  category: AssetCategory | null;
  sub_category: AssetSubCategory | null;
  serial_no: string | null;
  asset_type: string;
  radicare_asset_no: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  location: string | null;
  status: TicketStatus;
  disposal_method: DisposalMethod | null;
  rejection_reason: string | null;
  image_url: string | null;
  cert_url: string | null;
  borang_ca_url: string | null;
  // Nullable since migration 008: a hard-deleted user's tickets survive with
  // no owner rather than blocking the delete.
  created_by: string | null;
  reviewed_by: string | null;
  completed_by: string | null;
  created_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  ticket_id: string;
  action: string;
  old_value: string | null;
  new_value: string;
  // Nullable since migration 008 — same reason as created_by above.
  performed_by: string | null;
  created_at: string;
}
