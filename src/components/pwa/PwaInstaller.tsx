'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share2, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);

  useEffect(() => {
    // 1. Register PWA Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // Check for SW updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('[PWA] Service worker registration failed:', err);
        });
    }

    // 2. Check if already installed / running in standalone mode
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(Boolean(isStandaloneMode));
      return Boolean(isStandaloneMode);
    };

    if (checkStandalone()) return;

    // 3. Detect iOS / iPadOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIos(isAppleDevice);

    // 4. Handle Android / Chromium install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show banner if user hasn't dismissed it in the last 7 days
      try {
        const dismissedAt = localStorage.getItem('ds_pwa_dismissed_at');
        if (!dismissedAt || Date.now() - Number(dismissedAt) > 7 * 24 * 60 * 60 * 1000) {
          setShowBanner(true);
        }
      } catch {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // 5. If iOS and not dismissed, show prompt after 4 seconds
    if (isAppleDevice) {
      try {
        const dismissedAt = localStorage.getItem('ds_pwa_dismissed_at');
        if (!dismissedAt || Date.now() - Number(dismissedAt) > 7 * 24 * 60 * 60 * 1000) {
          const timer = setTimeout(() => setShowBanner(true), 4000);
          return () => clearTimeout(timer);
        }
      } catch {}
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Android / Chrome / Edge native install prompt
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowBanner(false);
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      // Show Apple iOS install instructions modal
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem('ds_pwa_dismissed_at', String(Date.now()));
    } catch {}
  };

  if (isStandalone || !showBanner) {
    return (
      <>
        {/* iOS Install Helper Modal */}
        {showIosGuide && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-sm bg-ds-dark border border-cyan-500/40 rounded-2xl p-5 shadow-2xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center mx-auto text-xl">
                📱
              </div>
              <div>
                <h3 className="font-heading font-black text-base text-white uppercase tracking-wide">
                  Install Dark Syndicate App
                </h3>
                <p className="text-xs text-ds-text-muted mt-1 leading-relaxed">
                  Install on your iPhone or iPad for instant fullscreen gaming & staff push notifications:
                </p>
              </div>

              <div className="bg-ds-surface/60 rounded-xl p-3 text-left space-y-2.5 text-xs border border-ds-border">
                <div className="flex items-center gap-2.5 text-ds-text">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <span>Tap Safari&apos;s <strong>Share</strong> button ( <Share2 className="w-3.5 h-3.5 inline text-cyan-400" /> ) in bottom bar</span>
                </div>
                <div className="flex items-center gap-2.5 text-ds-text">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <span>Scroll down and tap <strong>Add to Home Screen</strong> ( <PlusSquare className="w-3.5 h-3.5 inline text-cyan-400" /> )</span>
                </div>
                <div className="flex items-center gap-2.5 text-ds-text">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <span>Tap <strong>Add</strong> at top right to complete installation</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-heading font-bold uppercase text-xs tracking-wider transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Floating PWA Install Banner */}
      <aside
        aria-label="App installation"
        className="fixed top-4 sm:top-5 right-3 left-3 sm:left-auto sm:right-6 sm:w-96 z-[120] bg-ds-dark/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-heading font-black text-xs text-white uppercase tracking-wider truncate">
              Install Dark Syndicate
            </h4>
            <p className="text-[11px] text-ds-text-dim truncate">
              Fullscreen & instant lock-screen alerts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-heading font-black text-xs uppercase tracking-wide transition-all shadow-md shadow-cyan-500/20 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-xl text-ds-text-dim hover:text-white hover:bg-ds-surface/60 transition-colors"
            title="Dismiss"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* iOS Install Helper Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-ds-dark border border-cyan-500/40 rounded-2xl p-5 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center mx-auto text-xl">
              📱
            </div>
            <div>
              <h3 className="font-heading font-black text-base text-white uppercase tracking-wide">
                Install on iPhone or iPad
              </h3>
              <p className="text-xs text-ds-text-muted mt-1 leading-relaxed">
                Add to your home screen for native fullscreen mode and push alerts:
              </p>
            </div>

            <div className="bg-ds-surface/60 rounded-xl p-3 text-left space-y-2.5 text-xs border border-ds-border">
              <div className="flex items-center gap-2.5 text-ds-text">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <span>Tap Safari&apos;s <strong>Share</strong> button ( <Share2 className="w-3.5 h-3.5 inline text-cyan-400" /> ) in bottom bar</span>
              </div>
              <div className="flex items-center gap-2.5 text-ds-text">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <span>Scroll down and tap <strong>Add to Home Screen</strong> ( <PlusSquare className="w-3.5 h-3.5 inline text-cyan-400" /> )</span>
              </div>
              <div className="flex items-center gap-2.5 text-ds-text">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </div>
                <span>Tap <strong>Add</strong> at top right</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-heading font-bold uppercase text-xs tracking-wider transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}
