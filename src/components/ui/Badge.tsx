'use client';

import { cn } from '@/lib/utils';

// ─── Badge Component ────────────────────────────────────────────────────────

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'accent' | 'secondary';
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: 'bg-ds-surface-3 text-ds-text-muted border-ds-border',
  success: 'bg-ds-success-bg text-ds-success border-ds-success/30',
  warning: 'bg-ds-warning-bg text-ds-warning border-ds-warning/30',
  danger: 'bg-ds-danger-bg text-ds-danger border-ds-danger/30',
  info: 'bg-ds-info-bg text-ds-info border-ds-info/30',
  outline: 'bg-transparent text-ds-text-muted border-ds-border-light',
  accent: 'bg-ds-accent/15 text-ds-ice border-ds-accent/30',
  secondary: 'bg-ds-secondary/40 text-ds-text-muted border-ds-border',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  pulse = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-heading font-semibold',
        'rounded-full border whitespace-nowrap',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
              variant === 'success' && 'bg-ds-success',
              variant === 'warning' && 'bg-ds-warning',
              variant === 'danger' && 'bg-ds-danger',
              variant === 'info' && 'bg-ds-info',
              variant === 'default' && 'bg-ds-text-muted'
            )}
          />
          <span
            className={cn(
              'relative inline-flex rounded-full h-2 w-2',
              variant === 'success' && 'bg-ds-success',
              variant === 'warning' && 'bg-ds-warning',
              variant === 'danger' && 'bg-ds-danger',
              variant === 'info' && 'bg-ds-info',
              variant === 'default' && 'bg-ds-text-muted'
            )}
          />
        </span>
      )}
      {children}
    </span>
  );
}
