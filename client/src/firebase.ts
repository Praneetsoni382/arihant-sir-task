import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';
import firebaseConfig from './firebase-applet-config.json';

// Suppress noisy low-level connection warning logs in preview environments
try {
  setLogLevel('error');
} catch {
  // ignore
}

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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
