import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';
import { meetingApi } from './api';

export const MEET_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created';
export const EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';

const DEFAULT_GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '1088662376372-itpkdjisgp3r6pilfn0a216c758p9n78.apps.googleusercontent.com';

// In-memory token cache as mandated by workspace-integration guidelines
let cachedAccessToken: string | null = null;
let cachedUserEmail: string | null = null;

// Clear cached token on Firebase auth state changes
onAuthStateChanged(auth, (user: User | null) => {
  if (!user) {
    cachedAccessToken = null;
    cachedUserEmail = null;
  }
});

export function getCachedGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearGoogleTokenCache(): void {
  cachedAccessToken = null;
  cachedUserEmail = null;
}

declare global {
  interface Window {
    google?: any;
  }
}

/**
 * Dynamically loads Google Identity Services (GIS) library.
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
 * Methodology 1: Official Google Identity Services (GIS) Token Client.
 * Directly requests access token via Google OAuth 2.0 popup without relying on Firebase redirect handlers.
 */
async function requestTokenViaGis(): Promise<{ accessToken: string; email: string } | null> {
  const isLoaded = await loadGisScript();
  if (!isLoaded || !window.google?.accounts?.oauth2) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: DEFAULT_GOOGLE_CLIENT_ID,
        scope: `${MEET_SCOPE} ${EMAIL_SCOPE}`,
        callback: async (response: any) => {
          if (response?.error) {
            console.warn('GIS OAuth error notice:', response.error);
            resolve(null);
            return;
          }
          if (response?.access_token) {
            let email = '';
            try {
              const uRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` },
              });
              if (uRes.ok) {
                const uData = await uRes.json();
                email = uData.email || '';
              }
            } catch {
              // optional
            }
            resolve({ accessToken: response.access_token, email });
          } else {
            resolve(null);
          }
        },
        error_callback: (err: any) => {
          console.warn('GIS error callback:', err);
          resolve(null);
        },
      });

      client.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      console.warn('GIS initialization error:', err);
      resolve(null);
    }
  });
}

/**
 * Methodology 2: Firebase GoogleAuthProvider with signInWithPopup.
 */
async function requestTokenViaFirebasePopup(): Promise<{ accessToken: string; email: string } | null> {
  const provider = new GoogleAuthProvider();
  provider.addScope(MEET_SCOPE);
  provider.addScope(EMAIL_SCOPE);
  provider.setCustomParameters({
    prompt: 'select_account',
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;

  if (!token) {
    throw new Error('Firebase popup succeeded but no Google Meet access token was returned.');
  }

  return {
    accessToken: token,
    email: result.user.email || '',
  };
}

/**
 * Resilient multi-methodology Google Meet access token retrieval.
 * Tries GIS token client first -> Firebase Popup second -> Backend Status fallback.
 * Guaranteed never to navigate away or throw user out of the page.
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

  let result: { accessToken: string; email: string } | null = null;
  let lastError: any = null;

  // Methodology A: Official Google Identity Services (GIS) Token Client
  try {
    console.log('Attempting Method 1: Google Identity Services (GIS) Token Client...');
    result = await requestTokenViaGis();
  } catch (gisErr) {
    console.warn('Method 1 GIS failed, moving to Method 2 Firebase Popup:', gisErr);
    lastError = gisErr;
  }

  // Methodology B: Firebase signInWithPopup
  if (!result) {
    try {
      console.log('Attempting Method 2: Firebase signInWithPopup...');
      result = await requestTokenViaFirebasePopup();
    } catch (popupErr: any) {
      console.warn('Method 2 Firebase Popup failed:', popupErr);
      lastError = popupErr;
    }
  }

  // If a token was retrieved by either method, cache and sync with backend
  if (result?.accessToken) {
    cachedAccessToken = result.accessToken;
    cachedUserEmail = result.email || '';

    try {
      await meetingApi.connectManual({
        email: cachedUserEmail,
        accessToken: cachedAccessToken,
      });
    } catch (syncErr) {
      console.warn('Backend token sync notice:', syncErr);
    }

    return result;
  }

  // If user explicitly cancelled or popup was closed
  if (lastError?.code === 'auth/popup-closed-by-user' || lastError?.message?.includes('popup-closed-by-user')) {
    throw new Error('Sign-in popup was closed before completing authorization. Please try again.');
  }

  throw lastError || new Error('Could not authorize Google account. Please ensure popups are allowed or try Quick Connect.');
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
