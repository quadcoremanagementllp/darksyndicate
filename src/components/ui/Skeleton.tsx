import { cn } from '@/lib/utils';

// ─── Skeleton Loader Component ──────────────────────────────────────────────

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-shimmer',
        variant === 'text' && 'h-4 rounded',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-none',
        variant === 'rounded' && 'rounded-lg',
        className
      )}
      style={{
        width: width,
        height: height,
      }}
    />
  );
}

// ─── Preset Skeleton Patterns ───────────────────────────────────────────────

export function SkeletonCard() {
  return (
    <div className="bg-ds-surface border border-ds-border rounded-xl p-6 space-y-4">
      <Skeleton variant="rounded" className="w-full h-40" />
      <Skeleton className="w-3/4 h-6" />
      <Skeleton className="w-full h-4" />
      <Skeleton className="w-1/2 h-4" />
      <div className="flex gap-3 pt-2">
        <Skeleton variant="rounded" className="w-24 h-10" />
        <Skeleton variant="rounded" className="w-24 h-10" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-ds-surface border border-ds-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-ds-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="flex-1 h-4" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex gap-4 p-4 border-b border-ds-border last:border-b-0"
        >
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton key={col} className="flex-1 h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-ds-surface border border-ds-border rounded-xl p-6 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="w-20 h-4" />
              <Skeleton variant="circular" width={36} height={36} />
            </div>
            <Skeleton className="w-24 h-8" />
            <Skeleton className="w-16 h-3" />
          </div>
        ))}
      </div>
      {/* Chart + table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-ds-surface border border-ds-border rounded-xl p-6">
          <Skeleton className="w-40 h-6 mb-4" />
          <Skeleton variant="rounded" className="w-full h-64" />
        </div>
        <SkeletonTable rows={4} cols={3} />
      </div>
    </div>
  );
}
