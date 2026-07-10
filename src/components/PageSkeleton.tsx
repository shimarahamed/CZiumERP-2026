'use client';
import { Skeleton } from '@/components/ui/skeleton';

interface PageSkeletonProps {
  rows?: number;
  cols?: number;
  hasFilters?: boolean;
  cardCount?: number;
}

export function PageSkeleton({ rows = 8, cols = 5, hasFilters = true, cardCount }: PageSkeletonProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="flex h-16 shrink-0 items-center justify-between px-4 md:px-6 border-b bg-card">
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      {/* Breadcrumb skeleton */}
      <div className="px-4 md:px-6 py-2 border-b">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-2" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        {hasFilters && (
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-9 w-64 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        )}
        {cardCount ? (
          <div className={`grid gap-4 grid-cols-2 md:grid-cols-${Math.min(cardCount, 4)}`}>
            {Array.from({ length: cardCount }).map((_, i) => (
              <div key={`card-${i}`} className="rounded-lg border bg-card p-6 space-y-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/30">
              {Array.from({ length: cols }).map((_, i) => (
                <Skeleton key={`header-${i}`} className="h-4 flex-1" />
              ))}
            </div>
            {/* Table rows */}
            {Array.from({ length: rows }).map((_, i) => (
              <div key={`row-${i}`} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
                {Array.from({ length: cols }).map((_, j) => (
                  <Skeleton key={`cell-${i}-${j}`} className={`h-4 flex-1 ${j === 0 ? 'w-1/4' : ''}`} />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
