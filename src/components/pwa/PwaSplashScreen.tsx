'use client';

import React, { useEffect, useState } from 'react';

/**
 * Dark Syndicate Gaming World - PWA & Web App Loading Splash Screen
 * 
 * Provides an instantaneous, branded visual experience upon cold launch or PWA boot.
 * Prevents any black screen on mobile devices while React and Next.js hydrate.
 * Smoothly fades out and unmounts once the application is ready.
 */
export function PwaSplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Only show once per browser tab / PWA session to keep in-app navigation instantaneous
    try {
      if (sessionStorage.getItem('ds_pwa_splash_shown')) {
        setVisible(false);
        setMounted(true);
        return;
      }
      sessionStorage.setItem('ds_pwa_splash_shown', '1');
    } catch {
      // Ignore if sessionStorage is disabled or in restricted iframe
    }

    // Brief smooth display window to allow DOM and styles to settle
    const fadeTimer = setTimeout(() => {
      setVisible(false);
    }, 450);

    // Completely unmount from DOM after transition completes to free memory
    const removeTimer = setTimeout(() => {
      setMounted(true);
    }, 850);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (mounted) return null;

  return (
    <div
      id="pwa-splash-screen"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: '#0A111C',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.35s ease',
      }}
    >
      {/* Ambient background glow matching Dark Syndicate theme */}
      <div
        style={{
          position: 'absolute',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(22, 71, 155, 0.35) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        {/* Brand Icon with neon ice glow */}
        <div
          style={{
            width: '76px',
            height: '76px',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1px solid rgba(97, 173, 223, 0.35)',
            boxShadow: '0 0 35px rgba(97, 173, 223, 0.35), 0 10px 25px rgba(0,0,0,0.6)',
            backgroundColor: '#060A10',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px',
          }}
        >
          <img
            src="/logo-1024.png"
            alt="Dark Syndicate"
            width="76"
            height="76"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>

        {/* Brand Title */}
        <h1
          style={{
            fontFamily: "'Oxanium', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: '19px',
            fontWeight: 800,
            letterSpacing: '2.5px',
            color: '#FFFFFF',
            textTransform: 'uppercase',
            margin: '0 0 4px 0',
          }}
        >
          Dark Syndicate
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: "'Rajdhani', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '3.5px',
            color: '#61ADDF',
            textTransform: 'uppercase',
            margin: '0 0 28px 0',
          }}
        >
          Gaming World
        </p>

        {/* High-Tech Animated Loading Track */}
        <div
          style={{
            width: '140px',
            height: '3px',
            backgroundColor: 'rgba(97, 173, 223, 0.15)',
            borderRadius: '9999px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            className="ds-pwa-loader-bar"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: '50%',
              background: 'linear-gradient(90deg, transparent, #61ADDF, #79BDE9, transparent)',
              borderRadius: '9999px',
            }}
          />
        </div>

        {/* Subtle loading caption */}
        <span
          style={{
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '2px',
            color: '#6B7F96',
            textTransform: 'uppercase',
            marginTop: '12px',
          }}
        >
          Loading...
        </span>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes dsPwaBarSlide {
              0% { transform: translateX(-120%); }
              50% { transform: translateX(80%); }
              100% { transform: translateX(240%); }
            }
            .ds-pwa-loader-bar {
              animation: dsPwaBarSlide 1.3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }
          `,
        }}
      />
    </div>
  );
}
