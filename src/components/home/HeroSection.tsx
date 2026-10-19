'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, CirclePlay } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function HeroSection() {
  return (
    <section className="relative isolate min-h-[90vh] lg:min-h-screen overflow-hidden bg-ds-dark pt-24 sm:pt-28 pb-16 sm:pb-20 flex items-center">
      {/* Background Image & Cyber Overlays */}
      <div
        className="absolute inset-0 -z-20 bg-cover bg-center lg:bg-[center_top]"
        style={{ backgroundImage: "url('/DD.png')" }}
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(2,7,13,0.96)_0%,rgba(2,7,13,0.88)_35%,rgba(2,7,13,0.35)_65%,rgba(2,7,13,0.15)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-[#02070d] to-transparent" />

      {/* Main Content Container */}
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-8 lg:px-10">
        <div className="max-w-2xl">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-ds-accent/10 border border-ds-accent/30 text-ds-ice text-xs font-heading font-semibold tracking-wider uppercase backdrop-blur-sm mb-3 sm:mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-ds-accent animate-pulse" />
            <span>Next-Gen Gaming & Snooker Arena</span>
          </div>

          {/* Headline - Zero Gap Esports Stack */}
          <h1 className="font-heading text-5xl sm:text-6xl md:text-7xl lg:text-[4.75rem] font-black uppercase tracking-tight text-white drop-shadow-2xl leading-none">
            <span className="block">Play</span>
            <span className="block -mt-1.5 sm:-mt-2.5 lg:-mt-3.5 bg-gradient-to-r from-[#3299ff] via-[#18d6ea] to-[#58e0ef] bg-clip-text text-transparent">
              Beyond
            </span>
            <span className="block -mt-1.5 sm:-mt-2.5 lg:-mt-3.5">Reality</span>
          </h1>

          {/* Tagline */}
          <p className="mt-3.5 sm:mt-4 font-heading text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] text-ds-text-muted">
            Consoles <span className="px-1.5 text-ds-accent">·</span> PC Gaming <span className="px-1.5 text-ds-accent">·</span> Snooker <span className="px-1.5 text-ds-accent">·</span> Good Vibes
          </p>

          {/* Divider */}
          <div className="mt-3.5 h-0.5 w-24 bg-gradient-to-r from-ds-accent via-ds-accent/40 to-transparent" />

          {/* Action CTAs */}
          <div className="mt-6 flex flex-wrap items-center gap-3.5 sm:gap-4">
            <Link href="/booking">
              <Button
                size="lg"
                variant="accent"
                className="rounded-full px-6 py-3 text-sm font-heading font-bold uppercase tracking-wider shadow-[0_0_24px_rgba(41,186,255,0.35)] hover:shadow-[0_0_36px_rgba(41,186,255,0.55)] transition-all"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                Book Your Slot
                <ArrowRight className="ml-2 h-4 w-4 rounded-full bg-ds-dark/60 p-0.5 text-ds-ice" />
              </Button>
            </Link>

            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-ds-border-light/70 bg-ds-dark/60 px-5 py-3 font-heading text-sm font-semibold text-ds-text backdrop-blur-md transition hover:border-ds-accent hover:text-ds-ice hover:bg-ds-surface/70"
            >
              <CirclePlay className="h-4 w-4 text-ds-accent" />
              View Pricing & Rates
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
