'use client';

import { useEffect, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

// ─── Modal Component ────────────────────────────────────────────────────────

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  ariaLabel?: string;
  description?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  closeOnOverlay?: boolean;
  showCloseButton?: boolean;
  className?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  footerClassName?: string;
}

const sizeStyles: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
  full: 'w-full max-w-[96vw] h-[92vh] flex flex-col',
};

export function Modal({
  isOpen,
  onClose,
  title,
  ariaLabel,
  description,
  children,
  size = 'md',
  closeOnOverlay = true,
  showCloseButton = true,
  className,
  bodyClassName,
  footer,
  footerClassName,
}: ModalProps) {
  // Close on Escape
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-label={title ? undefined : ariaLabel}
        className={cn(
          'relative w-full bg-ds-surface border border-ds-border rounded-xl',
          'shadow-elevated animate-scale-in overflow-hidden max-h-[92vh] flex flex-col',
          sizeStyles[size],
          className
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between p-4 sm:p-6 pb-0 shrink-0">
            <div>
              {title && (
                <div
                  id="modal-title"
                  className="text-lg sm:text-xl font-heading font-bold text-ds-text"
                >
                  {title}
                </div>
              )}
              {description && (
                <p className="mt-1 text-xs sm:text-sm text-ds-text-muted">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className={cn(
                  'p-1.5 rounded-lg text-ds-text-muted',
                  'hover:text-ds-text hover:bg-ds-surface-2',
                  'transition-colors duration-[var(--transition-fast)] shrink-0 ml-2'
                )}
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div
          className={cn(
            'p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0',
            // If header was rendered, reduce top padding
            (title || showCloseButton) && 'pt-3 sm:pt-4',
            bodyClassName
          )}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className={cn(
              'shrink-0 border-t border-ds-border bg-ds-surface px-4 sm:px-6 py-3 sm:py-3.5',
              footerClassName
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
