import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BentoCardProps {
  children: ReactNode;
  span?: 1 | 2;
  className?: string;
}

export function BentoCard({ children, span = 1, className }: BentoCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm",
        "transition-[transform,box-shadow] duration-base ease-ios-out",
        "hover:-translate-y-px hover:shadow-md",
        span === 2 && "col-span-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
