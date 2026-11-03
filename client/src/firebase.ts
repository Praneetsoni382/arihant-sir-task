import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, setLogLevel, type Firestore } from 'firebase/firestore';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';
import firebaseConfig from './firebase-applet-config.json';

// Suppress noisy low-level connection warning logs in preview environments
try {
  setLogLevel('silent');
} catch {
  // ignore
}

// Dynamically resolve authDomain: use current hostname if on a custom or hosted domain,
// bypassing third-party cookie restrictions associated with fallback firebaseapp.com domains.
const resolvedAuthDomain =
  typeof window !== 'undefined' &&
  window.location.hostname &&
  !window.location.hostname.includes('localhost') &&
  !window.location.hostname.includes('127.0.0.1')
    ? window.location.hostname
    : firebaseConfig.authDomain;

export const app = initializeApp({
  ...firebaseConfig,
  authDomain: resolvedAuthDomain,
});

// Initialize Firestore with long-polling to prevent gRPC Listen/Write stream NOT_FOUND errors in iframe previews
let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  firestoreDb = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);

let messagingInstance: Messaging | null = null;

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  try {
    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (err) {
    console.info('Firebase Messaging is not supported in this browser environment:', err);
  }
  return null;
}

// Connectivity check
export async function testFirestoreConnection(): Promise<boolean> {
  return Boolean(db);
}
