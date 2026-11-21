'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error securely for diagnostics
    console.error('[Dark Syndicate Boundary Error]:', error);
  }, [error]);

  const handleHardReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-ds-dark">
      <div className="max-w-md w-full bg-ds-surface border border-ds-accent/30 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 text-center relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-ds-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-ds-accent/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-heading font-black uppercase tracking-wider text-ds-text mb-2">
            System Notice
          </h2>

          <p className="text-xs sm:text-sm text-ds-text-muted mb-6 leading-relaxed">
            The floor operations interface encountered a temporary synchronization issue. Your data and session are safe.
          </p>

          {error.digest && (
            <p className="text-[11px] font-mono text-ds-text-dim mb-6 bg-ds-darker/60 py-1.5 px-3 rounded-lg border border-ds-border inline-block">
              Code: {error.digest}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => reset()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-ds-accent text-ds-darker font-heading font-bold text-xs uppercase tracking-wider hover:bg-ds-accent-hover transition-all active:scale-[0.98] shadow-lg shadow-ds-accent/20 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>

            <button
              type="button"
              onClick={handleHardReload}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-ds-surface-2 border border-ds-border hover:border-ds-border-light text-ds-text font-heading font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] cursor-pointer"
            >
              Reload Page
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-ds-border/60">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs text-ds-text-dim hover:text-ds-ice transition-colors font-mono"
            >
              <Home className="w-3.5 h-3.5" />
              Return to Dark Syndicate Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
