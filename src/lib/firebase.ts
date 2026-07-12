
'use client';

import { initializeApp, getApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  disableNetwork,
  enableNetwork,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'your-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'your-auth-domain',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'your-project-id',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'your-storage-bucket',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? 'your-messaging-sender-id',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? 'your-app-id',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Use the modern persistent cache API (replaces deprecated enableMultiTabIndexedDbPersistence)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// Respect the user's offline preference from the Testing module on app load.
if (typeof window !== 'undefined' && localStorage.getItem('isOnline') === 'false') {
  disableNetwork(db);
}

const auth = getAuth(app);
const functions = getFunctions(app);

/**
 * Invite a user into the current tenant via the server (Cloud Function).
 * The server creates the Auth account, sets tenant/role claims, and writes
 * the profile doc — the only path that yields a sign-in-able account.
 * Throws if the functions backend is not deployed.
 */
export async function inviteTenantUser(input: { email: string; password: string; role: string; name: string; storeId?: string }): Promise<void> {
  const call = httpsCallable(functions, 'inviteUser');
  await call(input);
}

/**
 * Reset an existing tenant user's password via the server (Cloud Function).
 * Restricted to tenant admins and scoped to their own tenant.
 */
export async function resetTenantUserPassword(uid: string, newPassword: string): Promise<void> {
  const call = httpsCallable(functions, 'resetTenantUserPassword');
  await call({ uid, newPassword });
}

/**
 * Create a Firebase Auth account for a NEW user without replacing the
 * current admin's session. Uses a throwaway secondary app instance because
 * createUserWithEmailAndPassword signs in the created user on the app it
 * runs against.
 */
export async function createAuthAccount(email: string, password: string): Promise<void> {
  const secondary = initializeApp(auth.app.options, `secondary-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondary);
    await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await fbSignOut(secondaryAuth);
  } finally {
    await deleteApp(secondary);
  }
}

export { app, db, auth, enableNetwork, disableNetwork };
