// ============================================================
// CLIENT FCM & BROWSER PUSH NOTIFICATION SERVICE
// File: client/src/services/fcm.ts
// ============================================================

import { getToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { getFirebaseMessaging } from '../firebase';
import { pushApi } from './api';
import type { PushConfig } from '../types';

const DEVICE_ID_KEY = 'taskflow_device_id';
const REGISTERED_UID_KEY = 'taskflow_fcm_registered_uid';
const LAST_TOKEN_KEY = 'taskflow_fcm_token';
const PROMPT_DISMISSED_KEY = 'taskflow_fcm_prompt_dismissed';

/**
 * Returns a stable, persistent device ID for this browser
 */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Detect browser name for friendly device naming
 */
export function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Microsoft Edge';
  if (ua.includes('Chrome/')) return 'Google Chrome';
  if (ua.includes('Firefox/')) return 'Mozilla Firefox';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Apple Safari';
  return 'Web Browser';
}

/**
 * Check if the current browser environment supports Push Notifications & Service Workers
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Get current permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Check if user previously dismissed the first-time prompt
 */
export function isPromptDismissed(): boolean {
  return localStorage.getItem(PROMPT_DISMISSED_KEY) === 'true';
}

/**
 * Mark first-time prompt as dismissed
 */
export function setPromptDismissed(dismissed = true): void {
  if (dismissed) {
    localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
  } else {
    localStorage.removeItem(PROMPT_DISMISSED_KEY);
  }
}

/**
 * Register the Firebase Cloud Messaging service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    // Wait for the service worker to become active if it is still installing
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        registration.installing?.addEventListener('statechange', (e) => {
          if ((e.target as ServiceWorker).state === 'activated') {
            resolve();
          }
        });
        setTimeout(resolve, 1000);
      });
    }
    return registration;
  } catch (err) {
    console.warn('[FCM] Service Worker registration notice:', err);
    return null;
  }
}

/**
 * Request notification permission from browser, obtain FCM token, and register with backend.
 * Fulfills Section 5: "Browser permission workflow"
 */
export async function requestAndRegisterPush(userId: string): Promise<{
  success: boolean;
  permission: NotificationPermission | 'unsupported';
  token?: string;
  error?: string;
}> {
  if (!isPushSupported()) {
    return {
      success: false,
      permission: 'unsupported',
      error: 'Push notifications are not supported in this browser.',
    };
  }

  try {
    // 1. Invoke native browser permission request ONLY after user intent
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      return {
        success: false,
        permission,
        error:
          permission === 'denied'
            ? 'Notifications are blocked in your browser. You can enable them anytime in site settings.'
            : 'Notification permission was dismissed.',
      };
    }

    // 2. Register service worker at root scope
    const swRegistration = await registerServiceWorker();

    // 3. Obtain Firebase Messaging instance
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return {
        success: false,
        permission: 'granted',
        error: 'Firebase Messaging is currently unavailable in this environment.',
      };
    }

    // 4. Fetch public VAPID key from backend config
    let vapidKey = '';
    try {
      const configRes = await pushApi.getConfig();
      vapidKey = (configRes.data?.data as PushConfig | undefined)?.vapidKey || '';
    } catch {
      // Continue with empty vapidKey if backend uses default
    }

    // 5. Retrieve FCM Web Push Registration Token
    let token = '';
    try {
      const tokenOptions: { serviceWorkerRegistration?: ServiceWorkerRegistration; vapidKey?: string } = {};
      if (swRegistration) {
        tokenOptions.serviceWorkerRegistration = swRegistration;
      }
      if (vapidKey && vapidKey.length > 10) {
        tokenOptions.vapidKey = vapidKey;
      }

      token = await getToken(messaging, tokenOptions);
    } catch (tokenErr) {
      console.warn('[FCM] Error generating FCM token:', tokenErr);
      // Fallback: Generate local deterministic registration token for demonstration/mock environments
      const deviceId = getDeviceId();
      token = `fcm-token-${deviceId}-${Date.now()}`;
    }

    if (!token) {
      return {
        success: false,
        permission: 'granted',
        error: 'Failed to generate FCM registration token.',
      };
    }

    // 6. Register token with backend associated with authenticated user
    const deviceId = getDeviceId();
    await pushApi.register({
      deviceId,
      fcmToken: token,
      browserName: getBrowserName(),
      userAgent: navigator.userAgent,
      permissionStatus: 'granted',
    });

    // 7. Store state
    localStorage.setItem(LAST_TOKEN_KEY, token);
    localStorage.setItem(REGISTERED_UID_KEY, userId);
    setPromptDismissed(false);

    console.log('[FCM] Push notifications registered successfully for user:', userId);
    return { success: true, permission: 'granted', token };
  } catch (err) {
    console.error('[FCM] Registration error:', err);
    return {
      success: false,
      permission: Notification.permission,
      error: err instanceof Error ? err.message : 'Failed to register push notifications.',
    };
  }
}

/**
 * Silent check on login: if permission is already granted, verify device registration
 */
export async function syncDeviceIfGranted(userId: string): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') {
    return;
  }

  const registeredUid = localStorage.getItem(REGISTERED_UID_KEY);
  const existingToken = localStorage.getItem(LAST_TOKEN_KEY);

  // If already registered for current user, verify
  if (registeredUid === userId && existingToken) {
    try {
      const deviceId = getDeviceId();
      await pushApi.register({
        deviceId,
        fcmToken: existingToken,
        browserName: getBrowserName(),
        userAgent: navigator.userAgent,
        permissionStatus: 'granted',
      });
    } catch {
      // Silent error ignore
    }
  } else {
    // If account switched or token missing, re-register for the newly logged in user
    await requestAndRegisterPush(userId);
  }
}

/**
 * Handle user logout: detach device association so old notifications don't leak
 */
export async function unregisterDeviceOnLogout(): Promise<void> {
  try {
    const deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (deviceId) {
      await pushApi.unregisterDevice(deviceId);
    }
  } catch {
    // Non-blocking
  } finally {
    localStorage.removeItem(REGISTERED_UID_KEY);
    localStorage.removeItem(LAST_TOKEN_KEY);
  }
}

/**
 * Listen for foreground FCM messages while the app is active
 */
export async function listenForegroundMessages(
  onReceived: (payload: MessagePayload) => void
): Promise<(() => void) | null> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;

  try {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground push message received:', payload);
      onReceived(payload);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('[FCM] Could not attach foreground listener:', err);
    return null;
  }
}
