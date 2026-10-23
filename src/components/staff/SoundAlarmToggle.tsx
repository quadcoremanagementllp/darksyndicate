'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Bell, BellOff, Play, Smartphone } from 'lucide-react';
import {
  isAlarmSoundEnabled,
  setAlarmSoundEnabled,
  playOverdueAlarm,
  playEndingSoonAlarm,
  unlockAudio,
} from '@/lib/soundAlarm';
import {
  registerServiceWorker,
  requestPushPermission,
  getPushPermissionStatus,
  sendMobilePushNotification,
  type PushPermissionState,
} from '@/lib/pushNotifications';
import { useToast } from '@/components/ui/Toast';

export function SoundAlarmToggle() {
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean>(true);
  const [pushStatus, setPushStatus] = useState<PushPermissionState>('default');

  useEffect(() => {
    setEnabled(isAlarmSoundEnabled());

    // Initialize Service Worker and Push Notification permissions for mobile (Android / Apple / iPad)
    registerServiceWorker().then(() => {
      setPushStatus(getPushPermissionStatus());
    });

    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      if (customEvent.detail) {
        setEnabled(customEvent.detail.enabled);
      } else {
        setEnabled(isAlarmSoundEnabled());
      }
    };

    const handlePushSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ permission: string }>;
      if (customEvent.detail?.permission) {
        setPushStatus(customEvent.detail.permission as PushPermissionState);
      } else {
        setPushStatus(getPushPermissionStatus());
      }
    };

    window.addEventListener('ds-alarm-sound-changed', handleSync);
    window.addEventListener('ds-push-permission-changed', handlePushSync);

    return () => {
      window.removeEventListener('ds-alarm-sound-changed', handleSync);
      window.removeEventListener('ds-push-permission-changed', handlePushSync);
    };
  }, []);

  const handleToggle = async () => {
    unlockAudio();
    const next = !enabled;
    setEnabled(next);
    setAlarmSoundEnabled(next);

    // If enabling alarms and push notifications are not yet granted, request permission
    if (next && pushStatus === 'default') {
      const result = await requestPushPermission();
      setPushStatus(result);
      if (result === 'granted') {
        toast.success('Mobile push notifications enabled for this device!');
        sendMobilePushNotification('🔔 Dark Syndicate Mobile Push Enabled', {
          body: 'You will receive instant lock-screen alerts for overdue sessions and upcoming slots on this device.',
          tag: 'ds-push-enabled',
        });
      }
    }
  };

  const handleTestAlarm = async (e: React.MouseEvent, type: 'ending' | 'overdue') => {
    e.stopPropagation();
    unlockAudio();

    // 1. Play audio alarm
    if (type === 'overdue') {
      playOverdueAlarm();
    } else {
      playEndingSoonAlarm();
    }

    // 2. Request push permission if not granted
    if (pushStatus === 'default') {
      const perm = await requestPushPermission();
      setPushStatus(perm);
    }

    // 3. Dispatch native mobile push notification & vibration
    const sent = await sendMobilePushNotification('🚨 TEST MOBILE ALARM & VIBRATION', {
      body: 'Dark Syndicate mobile alerts are active! Haptic vibration and lock-screen banners are working. 🎮',
      tag: 'ds-test-alarm',
    });

    if (sent) {
      toast.success('Test alarm sound & mobile push notification sent!');
    } else if (pushStatus === 'denied') {
      toast.warning('Sound played. Mobile push notifications are blocked in browser site settings.');
    } else {
      toast.info('Test alarm sound played.');
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
        title={
          enabled
            ? `Alarm & Mobile Push is Active (${pushStatus === 'granted' ? 'Push Granted' : 'Push Pending'}) • Click to mute`
            : 'Alarm is Muted • Click to enable'
        }
      >
        {enabled ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Alarm: ON</span>
            {pushStatus === 'granted' && (
              <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.2 rounded-full">
                <Bell className="w-2.5 h-2.5 text-cyan-400" />
                <span>Push</span>
              </span>
            )}
          </>
        ) : (
          <>
            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Alarm: OFF</span>
          </>
        )}
      </button>

      {/* Test Alarm & Push Notification Trigger Button */}
      {enabled && (
        <button
          type="button"
          onClick={(e) => handleTestAlarm(e, 'overdue')}
          className="ml-1 p-1.5 rounded-lg border border-ds-border/60 hover:border-ds-accent/60 bg-ds-surface/50 text-[10px] text-ds-text-dim hover:text-ds-ice transition-colors flex items-center gap-1"
          title="Test Mobile Alarm & Push Notification"
          aria-label="Test Alarm"
        >
          <Play className="w-3 h-3 text-ds-accent" />
        </button>
      )}
    </div>
  );
}
