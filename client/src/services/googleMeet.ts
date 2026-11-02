import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebase';
import { meetingApi } from './api';
import firebaseConfig from '../firebase-applet-config.json';

export const MEET_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created';

// In-memory token cache as mandated by workspace-integration guidelines
let cachedAccessToken: string | null = null;
let cachedUserEmail: string | null = null;
let isAuthorizing = false;

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

/**
 * Obtains an active Google OAuth access token with Google Meet scope.
 * Uses same-origin callback flow to avoid cross-domain popup white screens.
 */
export async function getGoogleMeetAccessToken(interactive = true): Promise<{
  accessToken: string;
  email: string;
} | null> {
  // 1. Check in-memory cache
  if (cachedAccessToken) {
    return { accessToken: cachedAccessToken, email: cachedUserEmail || '' };
  }

  // 2. Check sessionStorage for token returned from full-page redirect
  const storedToken = sessionStorage.getItem('google_meet_access_token');
  const storedEmail = sessionStorage.getItem('google_meet_email');
  if (storedToken) {
    sessionStorage.removeItem('google_meet_access_token');
    sessionStorage.removeItem('google_meet_email');
    cachedAccessToken = storedToken;
    cachedUserEmail = storedEmail || '';
    try {
      await meetingApi.connectManual({
        email: cachedUserEmail,
        accessToken: cachedAccessToken,
      });
    } catch (syncErr) {
      console.warn('Token sync notice:', syncErr);
    }
    return { accessToken: cachedAccessToken, email: cachedUserEmail };
  }

  if (!interactive) {
    return null;
  }

  if (isAuthorizing) {
    await new Promise((r) => setTimeout(r, 500));
    if (cachedAccessToken) {
      return { accessToken: cachedAccessToken, email: cachedUserEmail || '' };
    }
  }

  try {
    isAuthorizing = true;
    const clientId =
      (firebaseConfig as any).oAuthClientId ||
      '1088662376372-itpkdjisgp3r6pilfn0a216c758p9n78.apps.googleusercontent.com';
    const redirectUri = `${window.location.origin}/oauth2callback.html`;
    const scope = encodeURIComponent(
      'https://www.googleapis.com/auth/meetings.space.created https://www.googleapis.com/auth/userinfo.email'
    );

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scope}&prompt=consent`;

    // Attempt Same-Origin Popup Window
    let popup: Window | null = null;
    try {
      popup = window.open(authUrl, 'GoogleMeetOAuth', 'width=540,height=650,top=100,left=100');
    } catch (e) {
      console.warn('Popup window blocked, falling back to redirect:', e);
    }

    if (!popup || popup.closed) {
      // Fall back to full-page redirect if popups are blocked by browser
      window.location.href = authUrl;
      return null;
    }

    const authResult = await new Promise<{ accessToken: string; email: string }>((resolve, reject) => {
      let finished = false;

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'GOOGLE_MEET_AUTH_SUCCESS') {
          finished = true;
          window.removeEventListener('message', handleMessage);
          clearInterval(timer);
          resolve({
            accessToken: event.data.accessToken,
            email: event.data.email || '',
          });
        } else if (event.data?.type === 'GOOGLE_MEET_AUTH_ERROR') {
          finished = true;
          window.removeEventListener('message', handleMessage);
          clearInterval(timer);
          reject(new Error(event.data.error || 'Google authorization failed'));
        }
      };

      window.addEventListener('message', handleMessage);

      const timer = setInterval(() => {
        if (popup && popup.closed && !finished) {
          finished = true;
          window.removeEventListener('message', handleMessage);
          clearInterval(timer);
          reject({
            code: 'auth/popup-closed-by-user',
            message: 'Sign-in popup was closed before completing authorization.',
          });
        }
      }, 500);
    });

    cachedAccessToken = authResult.accessToken;
    cachedUserEmail = authResult.email || '';

    // Synchronize token with backend repository for server-side REST API calls
    try {
      await meetingApi.connectManual({
        email: cachedUserEmail,
        accessToken: cachedAccessToken,
      });
    } catch (syncErr) {
      console.warn('Backend token synchronization notice:', syncErr);
    }

    return { accessToken: cachedAccessToken, email: cachedUserEmail };
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
