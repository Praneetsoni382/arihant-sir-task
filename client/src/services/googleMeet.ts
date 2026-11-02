import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';
import { meetingApi } from './api';

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

// Automatically process result if user returned from signInWithRedirect
getRedirectResult(auth)
  .then(async (result) => {
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        cachedUserEmail = result.user.email || '';
        try {
          await meetingApi.connectManual({
            email: cachedUserEmail,
            accessToken: cachedAccessToken,
          });
        } catch (syncErr) {
          console.warn('Backend token synchronization notice:', syncErr);
        }
      }
    }
  })
  .catch((err) => {
    console.warn('Redirect result check notice:', err);
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
 * Leverages Firebase Auth's registered redirect handler to avoid redirect_uri_mismatch.
 */
export async function getGoogleMeetAccessToken(interactive = true): Promise<{
  accessToken: string;
  email: string;
} | null> {
  // 1. Check in-memory cache
  if (cachedAccessToken) {
    return { accessToken: cachedAccessToken, email: cachedUserEmail || '' };
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
    const provider = new GoogleAuthProvider();
    provider.addScope(MEET_SCOPE);
    provider.addScope('https://www.googleapis.com/auth/userinfo.email');
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    let result: any = null;
    try {
      result = await signInWithPopup(auth, provider);
    } catch (popupErr: any) {
      if (popupErr?.code === 'auth/popup-blocked') {
        console.warn('Popup blocked by browser, executing signInWithRedirect fallback');
        await signInWithRedirect(auth, provider);
        return null;
      }
      throw popupErr;
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('Google authorization succeeded but no access token was returned for Google Meet.');
    }

    cachedAccessToken = token;
    cachedUserEmail = result.user.email || '';

    // Synchronize token with backend repository for server-side REST API calls
    try {
      await meetingApi.connectManual({
        email: cachedUserEmail || undefined,
        accessToken: cachedAccessToken || undefined,
      });
    } catch (syncErr) {
      console.warn('Backend token synchronization notice:', syncErr);
    }

    return { accessToken: cachedAccessToken || '', email: cachedUserEmail || '' };
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
