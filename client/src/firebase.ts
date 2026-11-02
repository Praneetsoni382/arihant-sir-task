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

const currentHost = typeof window !== 'undefined' && window.location.host ? window.location.host : '';
const dynamicConfig = {
  ...firebaseConfig,
  authDomain: currentHost || firebaseConfig.authDomain,
};

export const app = initializeApp(dynamicConfig);

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
