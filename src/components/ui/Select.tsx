'use client';

import { forwardRef, type SelectHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

// ─── Select Component ───────────────────────────────────────────────────────

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, icon, options, placeholder, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium font-heading text-ds-text-muted"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ds-text-dim z-10">
              {icon}
            </div>
          )}
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full bg-ds-surface-2 border border-ds-border rounded-lg appearance-none',
              'px-4 py-2.5 text-ds-text font-body font-medium text-base',
              'transition-all duration-[var(--transition-fast)]',
              'focus:outline-none focus:border-ds-accent focus:ring-1 focus:ring-ds-accent/30',
              'hover:border-ds-border-light',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'pr-10',
              icon && 'pl-10',
              error && 'border-ds-danger focus:border-ds-danger focus:ring-ds-danger/30',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ds-text-dim pointer-events-none" />
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

Select.displayName = 'Select';

export { Select };
