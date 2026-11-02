// ============================================================
// GOOGLE MEET SERVICE (CLIENT-SIDE)
// Directly interfaces with Google Meet REST API v2
// ============================================================

import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebase';
import { meetingApi } from './api';

export const MEET_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created';

// In-memory token cache as mandated by workspace-integration guidelines
// NEVER store Google OAuth access tokens in localStorage or sessionStorage
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
 * Uses in-memory caching and prompts Google Sign-in popup when needed.
 */
export async function getGoogleMeetAccessToken(interactive = true): Promise<{
  accessToken: string;
  email: string;
} | null> {
  if (cachedAccessToken) {
    return { accessToken: cachedAccessToken, email: cachedUserEmail || '' };
  }

  if (!interactive) {
    return null;
  }

  if (isAuthorizing) {
    // Wait briefly if another popup is already active
    await new Promise((r) => setTimeout(r, 500));
    if (cachedAccessToken) {
      return { accessToken: cachedAccessToken, email: cachedUserEmail || '' };
    }
  }

  try {
    isAuthorizing = true;
    const provider = new GoogleAuthProvider();
    provider.addScope(MEET_SCOPE);
    provider.setCustomParameters({
      prompt: 'consent',
      access_type: 'offline',
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('Google authorization succeeded but no access token was returned for Google Meet.');
    }

    cachedAccessToken = token;
    cachedUserEmail = result.user.email || '';

    // Synchronize token with backend for server-side persistence & operations
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
