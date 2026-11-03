import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { auth } from '../firebase';
import { meetingApi } from './api';

export const MEET_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created';
export const EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';

const DEFAULT_GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '1088662376372-itpkdjisgp3r6pilfn0a216c758p9n78.apps.googleusercontent.com';

// In-memory token cache
let cachedAccessToken: string | null = null;
let cachedUserEmail: string | null = null;
let isAuthorizing = false;

export function getCachedGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

export function setCachedGoogleToken(token: string, email?: string): void {
  cachedAccessToken = token;
  cachedUserEmail = email || null;
}

export function clearGoogleTokenCache(): void {
  cachedAccessToken = null;
  cachedUserEmail = null;
}

// Process redirect result automatically on load
if (typeof window !== 'undefined') {
  getRedirectResult(auth)
    .then(async (result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;
        const userEmail = result.user?.email || '';

        if (accessToken) {
          cachedAccessToken = accessToken;
          cachedUserEmail = userEmail;
          try {
            await meetingApi.connectManual({
              email: userEmail,
              accessToken,
            });
            console.log('✅ Google Meet OAuth token successfully stored via redirect handler');
          } catch (syncErr) {
            console.warn('Notice syncing Google token to backend:', syncErr);
          }
        }
      }
    })
    .catch((err) => {
      console.warn('Firebase Redirect Result notice:', err);
    });
}

declare global {
  interface Window {
    google?: any;
  }
}

/**
 * Dynamically loads Google Identity Services (GIS) library once.
 */
async function loadGisScript(): Promise<boolean> {
  if (window.google?.accounts?.oauth2) return true;
  return new Promise((resolve) => {
    const existing = document.getElementById('google-gis-script');
    if (existing) {
      if (window.google?.accounts?.oauth2) return resolve(true);
      existing.addEventListener('load', () => resolve(!!window.google?.accounts?.oauth2));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(!!window.google?.accounts?.oauth2);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/**
 * Full-page Redirect Mode sign-in (signInWithRedirect).
 * Bypasses popups entirely to resolve cross-origin popup restrictions in hosted production environments.
 */
export async function triggerGoogleMeetRedirect(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.addScope(MEET_SCOPE);
  provider.addScope(EMAIL_SCOPE);
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  await signInWithRedirect(auth, provider);
}

/**
 * Google Meet access token authorization.
 * Supports cached tokens, backend status verification, and single-trigger authorization.
 */
export async function getGoogleMeetAccessToken(interactive = true): Promise<{
  accessToken: string;
  email: string;
} | null> {
  // 1. Return in-memory cache if available
  if (cachedAccessToken) {
    return { accessToken: cachedAccessToken, email: cachedUserEmail || '' };
  }

  // 2. Non-interactive check: query backend status
  if (!interactive) {
    try {
      const statusRes = await meetingApi.getGoogleStatus();
      const statusData = statusRes.data?.data as any;
      if (statusData?.isConnected) {
        return {
          accessToken: 'backend_synced_token',
          email: statusData.connectedEmail || 'admin@company.com',
        };
      }
    } catch {
      // ignore
    }
    return null;
  }

  // 3. Prevent duplicate simultaneous authorization requests
  if (isAuthorizing) {
    throw new Error('Google authorization is already in progress. Please complete the sign-in prompt.');
  }

  try {
    isAuthorizing = true;
    const isGisLoaded = await loadGisScript();

    if (!isGisLoaded || !window.google?.accounts?.oauth2) {
      // Fall back to full-page redirect if GIS script fails
      await triggerGoogleMeetRedirect();
      return null;
    }

    return await new Promise<{ accessToken: string; email: string }>((resolve, reject) => {
      let resolved = false;

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: DEFAULT_GOOGLE_CLIENT_ID,
        scope: `${MEET_SCOPE} ${EMAIL_SCOPE}`,
        callback: async (response: any) => {
          if (resolved) return;
          resolved = true;

          if (response?.error) {
            if (response.error === 'access_denied') {
              reject(new Error('Sign-in cancelled: Access request was declined.'));
            } else {
              reject(new Error(`Google authorization notice: ${response.error}`));
            }
            return;
          }

          if (response?.access_token) {
            const token = response.access_token;
            let email = '';
            try {
              const uRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (uRes.ok) {
                const uData = await uRes.json();
                email = uData.email || '';
              }
            } catch {
              // optional
            }

            cachedAccessToken = token;
            cachedUserEmail = email;

            // Synchronize with backend database repository
            try {
              await meetingApi.connectManual({
                email: cachedUserEmail || undefined,
                accessToken: cachedAccessToken || undefined,
              });
            } catch (syncErr) {
              console.warn('Backend token sync notice:', syncErr);
            }

            resolve({ accessToken: token, email: cachedUserEmail || '' });
          } else {
            reject(new Error('No access token received from Google authorization.'));
          }
        },
        error_callback: (_err: any) => {
          if (resolved) return;
          resolved = true;
          reject(new Error('Sign-in Popup Notice: Popups were blocked or closed. Please try "Authorize via Google Sign-in (Redirect Mode)" or Quick Connect below.'));
        },
      });

      // Launch single OAuth popup
      client.requestAccessToken({ prompt: 'select_account' });
    });
  } finally {
    isAuthorizing = false;
  }
}

export interface GoogleMeetSpaceResult {
  googleSpaceName: string;
  meetingUri: string;
  meetingCode: string;
}

/**
 * Creates genuine Google Meet space via server-side proxy route
 * to avoid browser CORS restriction on meet.googleapis.com.
 */
export async function createRealGoogleMeetSpace(
  accessToken: string
): Promise<GoogleMeetSpaceResult> {
  if (!accessToken) {
    throw new Error('An active Google Meet access token is required to create a meeting space.');
  }

  const { default: api } = await import('./api');
  const response = await api.post('/admin/google/create-space', { accessToken });

  if (!response.data?.success || !response.data?.data) {
    throw new Error(response.data?.error || 'Failed to create Google Meet space');
  }

  const data = response.data.data;
  console.log(`✅ Genuine Google Meet space created via server proxy: ${data.meetingUri}`);

  return {
    googleSpaceName: data.googleSpaceName,
    meetingUri: data.meetingUri,
    meetingCode: data.meetingCode,
  };
}
