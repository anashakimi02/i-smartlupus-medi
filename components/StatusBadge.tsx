import { STATUS_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TicketStatus } from "@/lib/supabase/types";

interface StatusBadgeProps {
  status: TicketStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
        config.bg,
        config.color,
      )}
    >
      {config.label}
    </span>
  );
}
