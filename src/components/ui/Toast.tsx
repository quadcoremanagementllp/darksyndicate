'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

// ─── Toast Types ────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  toast: (title: string, type?: ToastType) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ─── Toast Provider ─────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const duration = toast.duration || 5000;

      setToasts((prev) => [...prev, { ...toast, id }]);

      setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  const toast = useCallback(
    (title: string, type: ToastType = 'info') =>
      addToast({ type, title }),
    [addToast]
  );
  const success = useCallback(
    (title: string, message?: string) =>
      addToast({ type: 'success', title, message }),
    [addToast]
  );
  const error = useCallback(
    (title: string, message?: string) =>
      addToast({ type: 'error', title, message, duration: 7000 }),
    [addToast]
  );
  const warning = useCallback(
    (title: string, message?: string) =>
      addToast({ type: 'warning', title, message }),
    [addToast]
  );
  const info = useCallback(
    (title: string, message?: string) =>
      addToast({ type: 'info', title, message }),
    [addToast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, toast, success, error, warning, info }}
    >
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export type UseToastReturn = {
  (title: string, type?: ToastType): void;
  toast: (title: string, type?: ToastType) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
};

export function useToast(): UseToastReturn {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const toastFn = ((title: string, type?: ToastType) => {
    context.toast(title, type);
  }) as UseToastReturn;

  toastFn.toast = context.toast;
  toastFn.success = context.success;
  toastFn.error = context.error;
  toastFn.warning = context.warning;
  toastFn.info = context.info;
  toastFn.toasts = context.toasts;
  toastFn.addToast = context.addToast;
  toastFn.removeToast = context.removeToast;

  return toastFn;
}

// ─── Toast Container ────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

// ─── Toast Item ─────────────────────────────────────────────────────────────

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap: Record<ToastType, string> = {
  success: 'border-l-ds-success',
  error: 'border-l-ds-danger',
  warning: 'border-l-ds-warning',
  info: 'border-l-ds-accent',
};

const iconColorMap: Record<ToastType, string> = {
  success: 'text-ds-success',
  error: 'text-ds-danger',
  warning: 'text-ds-warning',
  info: 'text-ds-accent',
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = iconMap[toast.type];

  return (
    <div
      className={cn(
        'pointer-events-auto glass-strong rounded-lg border-l-4 p-4',
        'animate-slide-in-right shadow-elevated',
        colorMap[toast.type]
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', iconColorMap[toast.type])} />
        <div className="flex-1 min-w-0">
          <p className="font-heading font-semibold text-sm text-ds-text">
            {toast.title}
          </p>
          {toast.message && (
            <p className="text-xs text-ds-text-muted mt-0.5">{toast.message}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-ds-surface-2 text-ds-text-dim hover:text-ds-text transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
