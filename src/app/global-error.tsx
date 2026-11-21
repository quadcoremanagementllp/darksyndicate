'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dark Syndicate Root Critical Error]:', error);
  }, [error]);

  const handleHardReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          backgroundColor: '#0A111C',
          color: '#F6F8FA',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            width: '100%',
            backgroundColor: '#0B0F17',
            border: '1px solid rgba(97, 173, 223, 0.35)',
            borderRadius: '24px',
            padding: '36px 24px',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F59E0B',
              fontSize: '24px',
              fontWeight: 'bold',
            }}
          >
            !
          </div>

          <h1
            style={{
              fontSize: '20px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              margin: '0 0 10px',
              color: '#FFFFFF',
            }}
          >
            Dark Syndicate
          </h1>

          <p
            style={{
              fontSize: '13px',
              color: '#A1B2C7',
              lineHeight: 1.6,
              margin: '0 0 24px',
            }}
          >
            The interface encountered a connection or runtime issue. Your active floor sessions and data are unaffected.
          </p>

          {error.digest && (
            <p
              style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#6B7F96',
                margin: '0 0 24px',
                backgroundColor: 'rgba(6, 10, 16, 0.6)',
                padding: '6px 12px',
                borderRadius: '8px',
                display: 'inline-block',
                border: '1px solid #1E293B',
              }}
            >
              Digest: {error.digest}
            </p>
          )}

          <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '12px',
                backgroundColor: '#61ADDF',
                color: '#060A10',
                border: 'none',
                fontWeight: 800,
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>

            <button
              type="button"
              onClick={handleHardReload}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '12px',
                backgroundColor: '#111827',
                color: '#F6F8FA',
                border: '1px solid #1E293B',
                fontWeight: 700,
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                cursor: 'pointer',
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
