// ============================================================
// GOOGLE MEET SERVICE & OAUTH INTEGRATION
// File: server/src/services/googleMeetService.ts
// ============================================================

import { googleAuthRepo } from '../repositories/inMemoryStore.js';
import type { GoogleAuthTokens } from '../types/index.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/admin/google/callback';

export const MEET_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created';
export const EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';

export function getGoogleOAuthUrl(stateStr: string = 'taskflow_meet'): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: `${MEET_SCOPE} ${EMAIL_SCOPE}`,
    access_type: 'offline',
    prompt: 'consent',
    state: stateStr,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, userId: string): Promise<GoogleAuthTokens> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are not configured on the backend server.'
    );
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Failed to exchange authorization code');
  }

  // Fetch connected user email
  let email = '';
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      email = userData.email || '';
    }
  } catch {
    // optional
  }

  const tokens: GoogleAuthTokens = {
    userId,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiryDate: Date.now() + (data.expires_in || 3600) * 1000,
    email: email || undefined,
    updatedAt: new Date().toISOString(),
  };

  await googleAuthRepo.saveTokens(tokens);
  return tokens;
}

export async function refreshAccessToken(userId: string): Promise<string> {
  const stored = googleAuthRepo.getTokens(userId);
  if (!stored || !stored.refreshToken) {
    throw new Error('No refresh token available. Please connect Google Account again.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: stored.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Failed to refresh Google token');
  }

  const updatedTokens: GoogleAuthTokens = {
    ...stored,
    accessToken: data.access_token,
    expiryDate: Date.now() + (data.expires_in || 3600) * 1000,
    updatedAt: new Date().toISOString(),
  };

  await googleAuthRepo.saveTokens(updatedTokens);
  return updatedTokens.accessToken;
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const stored = googleAuthRepo.getTokens(userId);
  if (!stored || !stored.accessToken) return null;

  // Check if expired (or within 5 min margin)
  if (stored.expiryDate && Date.now() > stored.expiryDate - 300000) {
    if (stored.refreshToken) {
      try {
        return await refreshAccessToken(stored.userId || userId);
      } catch (e) {
        console.warn('Token refresh error:', e);
        return stored.accessToken; // try existing access token if refresh fails transiently
      }
    }
  }

  return stored.accessToken;
}

export interface GoogleMeetSpaceResult {
  googleSpaceName: string;
  meetingUri: string;
  meetingCode: string;
}

export async function createGoogleMeetSpace(
  userId: string,
  customAccessToken?: string,
  requestId?: string,
  providedMeetingUri?: string,
  providedSpaceName?: string
): Promise<GoogleMeetSpaceResult> {
  // 1. If genuine meetingUri was generated directly by the client using Google Meet REST API v2
  if (providedMeetingUri && typeof providedMeetingUri === 'string' && providedMeetingUri.startsWith('https://meet.google.com/')) {
    const meetingCode = providedMeetingUri.split('/').pop() || '';
    const googleSpaceName = providedSpaceName || `spaces/${meetingCode}`;
    console.log(`✅ Using client-provided genuine Google Meet space: ${providedMeetingUri}`);
    return {
      googleSpaceName,
      meetingUri: providedMeetingUri,
      meetingCode,
    };
  }

  // 2. Obtain valid Google OAuth access token
  let token = customAccessToken || (await getValidAccessToken(userId));
  if (!token || token.startsWith('manual_')) {
    const allTokens = googleAuthRepo.getAllTokens();
    if (allTokens.length > 0 && allTokens[0].accessToken && !allTokens[0].accessToken.startsWith('manual_')) {
      token = allTokens[0].accessToken;
    }
  }

  if (token && !token.startsWith('manual_')) {
    // Official Google Meet REST API Call: POST https://meet.googleapis.com/v2/spaces
    let res = await fetch('https://meet.googleapis.com/v2/spaces', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          accessType: 'OPEN',
        },
      }),
    });

    // Handle 401 Unauthorized by attempting token refresh
    if (res.status === 401) {
      const stored = googleAuthRepo.getTokens(userId);
      if (stored && stored.refreshToken) {
        try {
          const refreshed = await refreshAccessToken(stored.userId || userId);
          if (refreshed) {
            token = refreshed;
            res = await fetch('https://meet.googleapis.com/v2/spaces', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                config: {
                  accessType: 'OPEN',
                },
              }),
            });
          }
        } catch (rErr) {
          console.warn('Token refresh during meeting space creation notice:', rErr);
        }
      }
    }

    if (res.ok) {
      const data = await res.json();
      // Returned schema from official Google Meet REST API:
      // { name: "spaces/abc-defg-hij", meetingUri: "https://meet.google.com/abc-defg-hij" }
      const meetingUri = data.meetingUri || `https://meet.google.com/${(data.name || '').replace('spaces/', '')}`;
      const spaceName = data.name || `spaces/${meetingUri.split('/').pop()}`;
      const meetingCode = data.meetingCode || meetingUri.split('/').pop() || '';

      console.log(`✅ Genuine Google Meet space created via Google Meet REST API: ${meetingUri}`);

      return {
        googleSpaceName: spaceName,
        meetingUri,
        meetingCode,
      };
    } else {
      const errText = await res.text().catch(() => '');
      let parsed: any;
      try { parsed = JSON.parse(errText); } catch {}
      const errMsg = parsed?.error?.message || errText || `HTTP ${res.status}`;
      throw new Error(`Google Meet API error (${res.status}): ${errMsg}. A genuine Google Meet link requires authorization with Google Meet permissions.`);
    }
  }

  // Under strict requirement: Never fabricate an arbitrary string URL.
  throw new Error(
    'Google Meet authorization required: No active Google Meet access token was found. Please connect your Google account with Google Meet permissions to create a genuine meeting link.'
  );
}
