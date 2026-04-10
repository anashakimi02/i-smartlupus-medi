export type UserRole = "user" | "unit_aset" | "admin";

export type AssetCondition = "rosak" | "usang";

export type TicketStatus =
  | "menunggu_semakan"
  | "proses_pelupusan"
  | "selesai"
  | "ditolak";

export type DisposalMethod = "jualan" | "lelong" | "musnah" | "serah_agensi";

export interface Profile {
  id: string;
  ic_number: string;
  full_name: string;
  role: UserRole;
  unit_name: string | null;
  created_at: string;
}

export interface DisposalTicket {
  id: string;
  ticket_no: string;
  asset_name: string;
  inventory_id: string | null;
  asset_condition: AssetCondition;
  location: string | null;
  status: TicketStatus;
  disposal_method: DisposalMethod | null;
  rejection_reason: string | null;
  image_url: string | null;
  cert_url: string | null;
  created_by: string;
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
  performed_by: string;
  created_at: string;
}
