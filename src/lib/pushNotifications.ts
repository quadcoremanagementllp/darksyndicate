/**
 * Mobile & Desktop Push Notification Helper for Dark Syndicate
 * Provides cross-platform native notifications for:
 * - Android (All phone & tablet models via Chrome, Samsung Internet, Edge, etc.)
 * - Apple iOS & iPadOS (iPhone & iPad via Safari Web Push / Standalone PWA)
 * - Desktop (macOS, Windows, Linux)
 */

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Checks whether push notifications are supported on this device/browser.
 */
export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window;
}

/**
 * Returns current notification permission status.
 */
export function getPushPermissionStatus(): PushPermissionState {
  if (!isPushNotificationSupported()) return 'unsupported';
  return Notification.permission as PushPermissionState;
}

/**
 * Registers the Dark Syndicate service worker for mobile push notifications.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    if (swRegistration) return swRegistration;

    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    swRegistration = registration;
    return registration;
  } catch (err) {
    console.warn('[PushNotification] Service worker registration error:', err);
    return null;
  }
}

/**
 * Requests push notification permission from the user.
 * Must be triggered by user gesture on iOS / iPadOS and modern Android.
 */
export async function requestPushPermission(): Promise<PushPermissionState> {
  if (!isPushNotificationSupported()) return 'unsupported';

  try {
    await registerServiceWorker();
    const result = await Notification.requestPermission();
    
    // Broadcast permission change
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ds-push-permission-changed', {
          detail: { permission: result },
        })
      );
    }
    return result as PushPermissionState;
  } catch (err) {
    console.warn('[PushNotification] Request permission error:', err);
    return 'default';
  }
}

export interface MobileNotificationOptions {
  body: string;
  tag?: string;
  url?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
}

/**
 * Dispatches a native push notification to mobile (Android / Apple iPhone & iPad) and desktop.
 * Automatically vibrates mobile devices with a high-priority cadence.
 */
export async function sendMobilePushNotification(
  title: string,
  options: MobileNotificationOptions
): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;

  // Check permission
  if (Notification.permission !== 'granted') {
    return false;
  }

  // 1. Trigger mobile haptic vibration (Android & compatible devices)
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([250, 100, 250, 100, 250]);
    }
  } catch {
    // Ignore vibration failure on unsupported devices
  }

  const notificationOptions: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body: options.body,
    icon: '/logo-1024.png',
    badge: '/logo.png',
    tag: options.tag || 'ds-floor-alert',
    renotify: options.renotify ?? true,
    requireInteraction: options.requireInteraction ?? true,
    data: {
      url: options.url || '/staff',
      timestamp: Date.now(),
    },
    // Vibration pattern for Android: vibrate 250ms, pause 100ms, vibrate 250ms...
    vibrate: [250, 100, 250, 100, 250],
  };

  // 2. Try service worker showNotification (Required on iOS 16.4+ iPhone/iPad and best for Android lock screen)
  try {
    if ('serviceWorker' in navigator) {
      const reg = swRegistration || (await navigator.serviceWorker.ready.catch(() => null));
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notificationOptions);
        return true;
      }
    }
  } catch (swErr) {
    console.warn('[PushNotification] SW showNotification failed, falling back:', swErr);
  }

  // 3. Fallback to standard Window Notification constructor
  try {
    const notif = new Notification(title, notificationOptions);
    notif.onclick = () => {
      window.focus();
      notif.close();
      if (options.url && window.location.pathname !== options.url) {
        window.location.href = options.url;
      }
    };
    return true;
  } catch (notifErr) {
    console.warn('[PushNotification] Window Notification failed:', notifErr);
    return false;
  }
}
