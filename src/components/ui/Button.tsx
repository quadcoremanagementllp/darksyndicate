'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// ─── Button Component ───────────────────────────────────────────────────────

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<string, string> = {
  primary:
    'bg-ds-primary text-ds-text hover:bg-ds-primary-hover shadow-md hover:shadow-lg',
  secondary:
    'bg-ds-secondary text-ds-text hover:bg-ds-secondary/80',
  danger:
    'bg-ds-danger text-white hover:bg-ds-danger/90',
  ghost:
    'bg-transparent text-ds-text-muted hover:text-ds-text hover:bg-ds-surface-2',
  outline:
    'bg-transparent border border-ds-border text-ds-text hover:border-ds-accent hover:text-ds-accent',
  accent:
    'bg-ds-accent text-ds-bg hover:bg-ds-accent-hover font-semibold',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-5 py-2.5 text-base gap-2',
  lg: 'px-7 py-3.5 text-lg gap-2.5',
  icon: 'p-2.5',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      disabled,
      type = 'button',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center font-heading font-semibold tracking-wide',
          'rounded-lg transition-all duration-[var(--transition-base)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          'active:scale-[0.98]',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
