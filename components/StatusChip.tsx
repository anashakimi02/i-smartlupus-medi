import { Chip, type ChipTone } from "@/components/ui/chip";
import type { TicketStatus } from "@/lib/supabase/types";

const toneMap: Record<TicketStatus, ChipTone> = {
  BARU: "neutral",
  menunggu_semakan: "pending",
  proses_pelupusan: "executing",
  selesai: "done",
  ditolak: "rejected",
};

const labelMap: Record<TicketStatus, string> = {
  BARU: "Baru",
  menunggu_semakan: "Menunggu Semakan",
  proses_pelupusan: "Proses Pelupusan",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

interface StatusChipProps {
  status: TicketStatus;
  className?: string;
}

export function StatusChip({ status, className }: StatusChipProps) {
  return (
    <Chip tone={toneMap[status]} className={className}>
      {labelMap[status]}
    </Chip>
  );
}
