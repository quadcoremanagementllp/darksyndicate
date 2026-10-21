'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Bell, BellOff, Play } from 'lucide-react';
import {
  isAlarmSoundEnabled,
  setAlarmSoundEnabled,
  playOverdueAlarm,
  playEndingSoonAlarm,
  unlockAudio,
} from '@/lib/soundAlarm';

export function SoundAlarmToggle() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [showMenu, setShowMenu] = useState<boolean>(false);

  useEffect(() => {
    setEnabled(isAlarmSoundEnabled());

    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      if (customEvent.detail) {
        setEnabled(customEvent.detail.enabled);
      } else {
        setEnabled(isAlarmSoundEnabled());
      }
    };

    window.addEventListener('ds-alarm-sound-changed', handleSync);
    return () => window.removeEventListener('ds-alarm-sound-changed', handleSync);
  }, []);

  const handleToggle = () => {
    unlockAudio();
    const next = !enabled;
    setEnabled(next);
    setAlarmSoundEnabled(next);
  };

  const handleTestAlarm = (e: React.MouseEvent, type: 'ending' | 'overdue') => {
    e.stopPropagation();
    unlockAudio();
    if (type === 'overdue') {
      playOverdueAlarm();
    } else {
      playEndingSoonAlarm();
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-heading font-bold transition-all shadow-sm ${
          enabled
            ? 'bg-ds-surface/80 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-400'
            : 'bg-ds-surface/60 border-ds-border text-ds-text-dim hover:text-white hover:border-white/20'
        }`}
        title={enabled ? 'Sound Alarm is Active (Click to mute)' : 'Sound Alarm is Muted (Click to enable)'}
      >
        {enabled ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Alarm: ON</span>
          </>
        ) : (
          <>
            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Alarm: OFF</span>
          </>
        )}
      </button>

      {/* Test Alarm Trigger Button */}
      {enabled && (
        <button
          type="button"
          onClick={(e) => handleTestAlarm(e, 'overdue')}
          className="ml-1 p-1.5 rounded-lg border border-ds-border/60 hover:border-ds-accent/60 bg-ds-surface/50 text-[10px] text-ds-text-dim hover:text-ds-ice transition-colors"
          title="Test Overdue Alarm Sound"
        >
          <Play className="w-3 h-3 text-ds-accent" />
        </button>
      )}
    </div>
  );
}
