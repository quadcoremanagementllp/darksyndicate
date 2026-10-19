'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { SortDirection } from '@/types/api';

// ─── Table Component ────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  render?: (value: unknown, row: T, index: number) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onSort?: (key: string, direction: SortDirection) => void;
  sortKey?: string;
  sortDirection?: SortDirection;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  className?: string;
  onRowClick?: (row: T) => void;
  stickyHeader?: boolean;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  onSort,
  sortKey,
  sortDirection,
  isLoading = false,
  emptyMessage = 'No data found',
  emptyIcon,
  className,
  onRowClick,
  stickyHeader = false,
}: DataTableProps<T>) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const handleSort = (key: string) => {
    if (!onSort) return;
    const newDirection: SortDirection =
      sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(key, newDirection);
  };

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-ds-accent" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-ds-accent" />
    );
  };

  return (
    <div
      className={cn(
        'bg-ds-surface border border-ds-border rounded-xl overflow-hidden',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className={cn(
                'border-b border-ds-border bg-ds-surface-2',
                stickyHeader && 'sticky top-0 z-10'
              )}
            >
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left font-heading font-semibold text-ds-text-muted text-xs uppercase tracking-wider',
                    col.sortable && 'cursor-pointer select-none hover:text-ds-text',
                    col.headerClassName
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && getSortIcon(col.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-b border-ds-border">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 rounded animate-shimmer" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-3 text-ds-text-dim">
                    {emptyIcon}
                    <p className="font-heading font-medium">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const key = keyExtractor(row);
                return (
                  <tr
                    key={key}
                    className={cn(
                      'border-b border-ds-border last:border-b-0',
                      'transition-colors duration-[var(--transition-fast)]',
                      hoveredRow === key && 'bg-ds-surface-2',
                      onRowClick && 'cursor-pointer'
                    )}
                    onMouseEnter={() => setHoveredRow(key)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3 text-ds-text',
                          col.className
                        )}
                      >
                        {col.render
                          ? col.render(row[col.key], row, index)
                          : (row[col.key] as ReactNode)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
