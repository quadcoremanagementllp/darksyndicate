'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const marketingPaths = new Set(['/', '/pricing', '/membership', '/contact']);

export function ScrollRevealController() {
  const pathname = usePathname();

  useEffect(() => {
    if (!marketingPaths.has(pathname)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const prepared = new WeakSet<HTMLElement>();
    const pending = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.dataset.revealState = 'shown';
          pending.delete(element);
          observer.unobserve(element);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );

    const prepare = () => {
      document.querySelectorAll<HTMLElement>('main [data-scroll-reveal]').forEach((element) => {
        if (prepared.has(element)) return;
        prepared.add(element);

        if (element.dataset.revealState === 'shown' || element.getBoundingClientRect().top < window.innerHeight * 0.9) {
          element.dataset.revealState = 'shown';
          return;
        }

        element.dataset.revealState = 'pending';
        pending.add(element);
        observer.observe(element);
      });
    };

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedPrepare = () => {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        prepare();
      }, 150);
    };

    prepare();
    const mutations = new MutationObserver(debouncedPrepare);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      mutations.disconnect();
      observer.disconnect();
      pending.forEach((element) => { element.dataset.revealState = 'shown'; });
    };
  }, [pathname]);

  return null;
}
