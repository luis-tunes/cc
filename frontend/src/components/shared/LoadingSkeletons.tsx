import { Skeleton } from "@/components/ui/skeleton";

export function KpiSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3" role="status" aria-label="A carregar">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-10 w-full mt-1" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-lg border bg-card animate-in fade-in duration-300" role="status" aria-label="A carregar">
      {/* Header */}
      <div className="flex gap-4 border-b px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      <div className="skeleton-stagger">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 border-b last:border-b-0 px-4 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-48 w-full rounded" />
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-48 w-full rounded" />
        </div>
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <Skeleton className="h-5 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DocumentListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-lg border bg-card animate-in fade-in duration-300">
      <div className="flex items-center gap-4 border-b px-4 py-3">
        <Skeleton className="h-4 w-4 rounded-sm" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16 ml-auto" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="skeleton-stagger">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b last:border-b-0 px-4 py-3">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Skeleton className="h-8 w-8 rounded" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3.5 w-16 ml-auto" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MovementLedgerSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-lg border bg-card animate-in fade-in duration-300">
      <div className="flex items-center gap-4 border-b px-4 py-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-16 ml-auto" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="skeleton-stagger">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b last:border-b-0 px-4 py-3">
            <Skeleton className="h-3.5 w-16" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-56" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </div>
      <TableSkeleton />
    </div>
  );
}
