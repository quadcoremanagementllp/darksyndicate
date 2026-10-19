'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Gamepad, Trophy, Monitor, Disc } from 'lucide-react';

interface StatItem {
  icon: React.ElementType;
  value: string;
  numTarget?: number;
  suffix?: string;
  prefix?: string;
  label: string;
  sub: string;
}

const stats: StatItem[] = [
  {
    icon: Gamepad,
    value: '8+',
    numTarget: 8,
    suffix: '+',
    label: 'PS5 Pro Consoles',
    sub: 'Custom Liquid-Cooled Rigs',
  },
  {
    icon: Trophy,
    value: '3',
    numTarget: 3,
    suffix: '',
    label: 'Championship Tables',
    sub: 'Italian Slate & Simonis 860',
  },
  {
    icon: Monitor,
    value: '120Hz',
    numTarget: 120,
    suffix: 'Hz',
    prefix: '4K @ ',
    label: 'OLED Refresh Rate',
    sub: 'Ultra-low 0.1ms Input Latency',
  },
  {
    icon: Disc,
    value: '250+',
    numTarget: 250,
    suffix: '+',
    label: 'Digital AAA Library',
    sub: 'Day-One Released Titles',
  },
];

export function LiveStatsBar() {
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.2 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="live-stats"
      ref={containerRef}
      className="relative py-12 bg-ds-surface/60 border-y border-ds-border/80 backdrop-blur-xl overflow-hidden z-20"
    >
      {/* Laser line runner */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-ds-accent/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-ds-accent/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="group relative p-5 rounded-2xl bg-ds-dark/60 border border-ds-border hover:border-ds-accent/50 transition-all duration-300 hover:shadow-glow hover:-translate-y-1 overflow-hidden"
              >
                {/* Cyber Corner Marks */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-ds-accent/40 group-hover:border-ds-accent transition-colors" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-ds-accent/40 group-hover:border-ds-accent transition-colors" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-ds-accent/40 group-hover:border-ds-accent transition-colors" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-ds-accent/40 group-hover:border-ds-accent transition-colors" />

                {/* Ambient Card Glow */}
                <div className="absolute -inset-px bg-gradient-to-r from-ds-accent/0 via-ds-accent/5 to-ds-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-xl bg-ds-surface border border-ds-border flex items-center justify-center text-ds-accent mb-3 group-hover:scale-110 group-hover:border-ds-accent transition-all duration-300 shadow-glow-sm">
                    <Icon className="w-5 h-5 text-ds-accent" />
                  </div>

                  <div className="text-3xl sm:text-4xl font-heading font-extrabold gradient-text tracking-tight">
                    {inView ? stat.value : '0'}
                  </div>

                  <div className="text-sm font-heading font-bold text-ds-text uppercase tracking-wider mt-1 group-hover:text-ds-ice transition-colors">
                    {stat.label}
                  </div>

                  <div className="text-xs text-ds-text-dim mt-0.5 line-clamp-1">
                    {stat.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default LiveStatsBar;
