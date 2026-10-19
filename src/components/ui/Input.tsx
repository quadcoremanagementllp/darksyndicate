'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ─── Input Component ────────────────────────────────────────────────────────

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  rightIcon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, rightIcon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium font-heading text-ds-text-muted"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ds-text-dim">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-ds-surface-2 border border-ds-border rounded-lg',
              'px-4 py-2.5 text-ds-text placeholder:text-ds-text-dim',
              'font-body font-medium text-base',
              'transition-all duration-[var(--transition-fast)]',
              'focus:outline-none focus:border-ds-accent focus:ring-1 focus:ring-ds-accent/30',
              'hover:border-ds-border-light',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              icon && 'pl-10',
              rightIcon && 'pr-10',
              error && 'border-ds-danger focus:border-ds-danger focus:ring-ds-danger/30',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-ds-text-dim">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-sm text-ds-danger font-medium animate-fade-in">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-ds-text-dim">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
