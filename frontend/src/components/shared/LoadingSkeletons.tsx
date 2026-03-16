import { Skeleton } from "@/components/ui/skeleton";

export function KpiSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-2 h-8 w-16" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex gap-4 border-b px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b last:border-b-0 px-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
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
