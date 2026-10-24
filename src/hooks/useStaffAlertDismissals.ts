'use client';

import { useCallback, useEffect, useState } from 'react';
import { staffAlertDismissalKey, type StaffAlertKind, type StaffAlertStage } from '@/lib/staffAlertDismissals';
import { useToast } from '@/components/ui/Toast';

export function useStaffAlertDismissals() {
  const { error: showError } = useToast();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/staff/alerts/dismissals', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load alert dismissals');
      const json = await response.json();
      if (json.success && Array.isArray(json.data)) {
        setDismissedIds((previous) => {
          const incoming = json.data.filter((id: unknown): id is string => typeof id === 'string');
          if (incoming.every((id: string) => previous.has(id))) return previous;
          return new Set([...previous, ...incoming]);
        });
      }
    } catch (error) {
      console.error('Could not load staff alert dismissals:', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => { void refresh(); }, 0);
    const poll = window.setInterval(() => { void refresh(); }, 10000);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const dismiss = useCallback(async (kind: StaffAlertKind, resourceId: string, stage: StaffAlertStage) => {
    const id = staffAlertDismissalKey(kind, resourceId, stage);
    setDismissedIds((previous) => new Set(previous).add(id));
    try {
      const response = await fetch('/api/staff/alerts/dismissals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, resourceId, stage }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || 'Could not save alert dismissal');
      }
    } catch (error) {
      console.error('Could not save staff alert dismissal:', error);
      showError('Could not dismiss alert', error instanceof Error ? error.message : 'Please try again.');
      setDismissedIds((previous) => {
        const restored = new Set(previous);
        restored.delete(id);
        return restored;
      });
    }
  }, [showError]);

  return { dismissedIds, loaded, dismiss };
}
