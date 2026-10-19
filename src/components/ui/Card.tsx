'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ─── Card Component ─────────────────────────────────────────────────────────

export interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'hover' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  glass?: boolean;
  onClick?: () => void;
}

const paddingStyles: Record<string, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  children,
  className,
  variant = 'default',
  padding = 'md',
  hover = false,
  glass = false,
  onClick,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl',
        variant === 'default' && !glass && 'bg-ds-surface border border-ds-border',
        (variant === 'glass' || glass) && 'glass',
        (variant === 'hover' || hover) &&
          'hover-lift cursor-pointer hover:border-ds-accent/30',
        variant === 'bordered' &&
          'bg-ds-surface-2 border border-ds-border-light',
        paddingStyles[padding],
        className
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

// ─── Card Sub-components ────────────────────────────────────────────────────

export function CardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4', className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        'text-lg font-heading font-bold text-ds-text',
        className
      )}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn('text-sm text-ds-text-muted mt-1', className)}>
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('', className)}>{children}</div>;
}

export function CardFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mt-4 pt-4 border-t border-ds-border flex items-center gap-3',
        className
      )}
    >
      {children}
    </div>
  );
}
