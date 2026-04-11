import { cn } from "@/lib/utils";

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-slate-200/70",
        className,
      )}
    />
  );
}

/** Skeleton for a single stat card */
export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl bg-slate-100/50 p-5">
      <div className="flex items-center gap-4">
        <SkeletonPulse className="w-11 h-11 rounded-xl" />
        <div className="space-y-2">
          <SkeletonPulse className="h-2.5 w-16" />
          <SkeletonPulse className="h-6 w-12" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for a ticket card row */
export function TicketCardSkeleton() {
  return (
    <div className="rounded-xl bg-white px-4 py-3.5 border border-slate-100">
      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <SkeletonPulse className="h-3 w-20" />
            <SkeletonPulse className="h-5 w-16 rounded-full" />
          </div>
          <SkeletonPulse className="h-4 w-48" />
          <SkeletonPulse className="h-3 w-32" />
        </div>
        <SkeletonPulse className="h-5 w-5 rounded" />
      </div>
    </div>
  );
}

/** Skeleton for the dashboard page */
export function DashboardSkeleton() {
  return (
    <div>
      <div className="mb-8 space-y-2">
        <SkeletonPulse className="h-7 w-56" />
        <SkeletonPulse className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    </div>
  );
}

/** Skeleton for a list of ticket cards */
export function TicketListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <TicketCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default SkeletonPulse;
