// ============================================================
// FIREBASE FIRESTORE & AUTH INITIALIZATION (SERVER)
// ============================================================

import { initializeApp as initializeClientApp, getApps as getClientApps } from 'firebase/app';
import {
  getFirestore as getClientFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection as firestoreCollection,
  type Firestore as ClientFirestore
} from 'firebase/firestore';
import { initializeApp as initializeAdminApp, getApps as getAdminApps, cert, type App } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

export interface FirebaseConfig {
  projectId: string;
  apiKey?: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  clientEmail?: string;
  privateKey?: string;
}

function loadConfig(): FirebaseConfig {
  let config: Record<string, any> = {};

  const possiblePaths = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(process.cwd(), '../firebase-applet-config.json'),
    path.resolve(import.meta.dirname, '../../firebase-applet-config.json'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        config = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      } catch {
        // ignore and continue
      }
    }
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID || config.projectId || 'gen-lang-client-0565045974',
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || config.firestoreDatabaseId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || config.storageBucket,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
}

export const firebaseConfig = loadConfig();

let adminApp: App | null = null;
let adminDbInstance: AdminFirestore | null = null;
let adminAuthInstance: Auth | null = null;
let clientDbInstance: ClientFirestore | null = null;
let isConnected = false;

// Initialize Admin App (if credentials present)
try {
  if (getAdminApps().length === 0) {
    if (firebaseConfig.clientEmail && firebaseConfig.privateKey) {
      adminApp = initializeAdminApp({
        credential: cert({
          projectId: firebaseConfig.projectId,
          clientEmail: firebaseConfig.clientEmail,
          privateKey: firebaseConfig.privateKey,
        }),
        storageBucket: firebaseConfig.storageBucket,
      });
      console.log('🔥 Firebase Admin initialized with Service Account credentials');
    } else {
      adminApp = initializeAdminApp({
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
      });
      console.log(`🔥 Firebase Admin initialized with Project ID: ${firebaseConfig.projectId}`);
    }
  } else {
    adminApp = getAdminApps()[0];
  }

  if (adminApp) {
    adminAuthInstance = getAuth(adminApp);
    adminDbInstance = firebaseConfig.firestoreDatabaseId
      ? getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
      : getAdminFirestore(adminApp);
  }
} catch (err) {
  console.warn('⚠️ Firebase Admin initialization notice:', err);
}

// Initialize Client Web SDK for persistent operations
try {
  const clientApps = getClientApps();
  const cApp = clientApps.length > 0 ? clientApps[0] : initializeClientApp({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
  });
  clientDbInstance = firebaseConfig.firestoreDatabaseId
    ? getClientFirestore(cApp, firebaseConfig.firestoreDatabaseId)
    : getClientFirestore(cApp);
  isConnected = true;
  console.log(`🔥 Client Firestore initialized for database: ${firebaseConfig.firestoreDatabaseId || 'default'}`);
} catch (err) {
  console.warn('⚠️ Client Firestore initialization notice:', err);
}

export const firestoreDb = {
  async docSet(collectionPath: string, docId: string, data: any): Promise<void> {
    const cleanData = JSON.parse(JSON.stringify(data));
    if (clientDbInstance) {
      const docRef = doc(clientDbInstance, collectionPath, docId);
      await setDoc(docRef, cleanData, { merge: true });
    } else if (adminDbInstance) {
      await adminDbInstance.collection(collectionPath).doc(docId).set(cleanData, { merge: true });
    }
  },

  async docGet(collectionPath: string, docId: string): Promise<any | null> {
    if (clientDbInstance) {
      const docRef = doc(clientDbInstance, collectionPath, docId);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() : null;
    } else if (adminDbInstance) {
      const snap = await adminDbInstance.collection(collectionPath).doc(docId).get();
      return snap.exists ? snap.data() : null;
    }
    return null;
  },

  async collectionGetAll(collectionPath: string): Promise<any[]> {
    if (clientDbInstance) {
      const colRef = firestoreCollection(clientDbInstance, collectionPath);
      const snap = await getDocs(colRef);
      return snap.docs.map((d) => d.data());
    } else if (adminDbInstance) {
      const snap = await adminDbInstance.collection(collectionPath).get();
      return snap.docs.map((d) => d.data());
    }
    return [];
  },

  async docDelete(collectionPath: string, docId: string): Promise<void> {
    if (clientDbInstance) {
      const docRef = doc(clientDbInstance, collectionPath, docId);
      await deleteDoc(docRef);
    } else if (adminDbInstance) {
      await adminDbInstance.collection(collectionPath).doc(docId).delete();
    }
  }
};

export { adminApp, adminAuthInstance as adminAuth, adminDbInstance as adminDb, isConnected as isFirebaseConfigured };

