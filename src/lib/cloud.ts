/**
 * Firebase sync. Loaded lazily (dynamic import) only when Firebase is configured.
 * Data lives in Firestore at users/{uid} as { data: JSON string, updated } — the same format as StreakFire v3.
 */
import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, connectAuthEmulator, createUserWithEmailAndPassword, getAuth, getRedirectResult, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, updateProfile } from 'firebase/auth';
import { connectFirestoreEmulator, doc, initializeFirestore, onSnapshot, persistentLocalCache, persistentMultipleTabManager, serverTimestamp, setDoc, type DocumentReference } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config';
import { STORAGE_KEY, useApp } from '../store/app';
import { blank, normalize } from './seed';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
// Local testing against the Firebase Emulator Suite (set VITE_USE_EMULATOR=1).
if (import.meta.env.VITE_USE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

let ref: DocumentReference | null = null;
let unsub: (() => void) | null = null;
let lastPushed = '';
let pushT: ReturnType<typeof setTimeout> | undefined;
const set = useApp.setState;

async function push() {
  if (!ref) return;
  const j = JSON.stringify(useApp.getState().data);
  if (j === lastPushed) { set({ sync: 'saved' }); return; }
  lastPushed = j;
  try {
    await setDoc(ref, { data: j, updated: serverTimestamp() });
    set({ sync: navigator.onLine ? 'saved' : 'offline' });
  } catch (e) {
    set({ sync: 'error' });
    console.error('StreakFire sync failed', e);
  }
}

export function startCloud() {
  getRedirectResult(auth).catch((e) => set({ auth: 'signed-out', authMessage: `Sign-in failed: ${e.message || e.code}` }));

  onAuthStateChanged(auth, (u) => {
    unsub?.(); unsub = null;
    if (!u) { ref = null; set({ auth: 'signed-out', user: null, sync: 'local' }); return; }
    set({ auth: 'loading', authMessage: '', user: { email: u.email, name: u.displayName } });
    ref = doc(db, 'users', u.uid);
    unsub = onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      if (!snap.exists()) {
        if (snap.metadata.fromCache) return; // wait for the server before creating a document
        let local: unknown = null;
        try { local = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { /* ignore */ }
        const start = local && !(local as { sample?: boolean }).sample ? normalize(local) : blank(u.displayName || u.email?.split('@')[0] || 'You');
        lastPushed = '';
        useApp.getState().setData(start);
        void push();
        set({ auth: 'ready' });
        return;
      }
      const j = snap.data().data as string | undefined;
      if (j && j !== lastPushed) { lastPushed = j; useApp.getState().setData(normalize(JSON.parse(j))); }
      set({ auth: 'ready', sync: snap.metadata.fromCache ? 'offline' : 'saved' });
    }, (e) => {
      if (e.code === 'permission-denied') set({ auth: 'denied', authMessage: `${u.email} doesn't have access. Check that the Firestore rules from firestore.rules are published.` });
      else set({ auth: 'error', authMessage: `Could not load your data (${e.code || e.message}).`, sync: 'error' });
    });
  });

  useApp.subscribe((s, p) => {
    if (s.data === p.data || !ref) return;
    if (JSON.stringify(s.data) === lastPushed) return;
    set({ sync: 'saving' });
    clearTimeout(pushT);
    pushT = setTimeout(() => void push(), 500);
  });
  addEventListener('online', () => void push());
  addEventListener('offline', () => set({ sync: 'offline' }));
}

export async function signInWithGoogle() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  try { await signInWithPopup(auth, p); }
  catch (err) {
    const c = (err as { code?: string }).code || '';
    if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, p);
    else if (c !== 'auth/popup-closed-by-user' && c !== 'auth/cancelled-popup-request') set({ authMessage: authError(err) });
  }
}
const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with that email. Create one first.',
  'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
  'auth/invalid-email': 'That email address is not valid.',
  'auth/weak-password': 'Use a password of at least 6 characters.',
  'auth/missing-password': 'Enter your password.',
  'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
  'auth/operation-not-allowed': 'Email sign-in is not turned on in Firebase (Authentication > Sign-in method).',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The Firebase API key is wrong. Check the VITE_FIREBASE_* environment variables.',
  'auth/unauthorized-domain': 'This website is not allowed to sign in yet. Add its domain under Firebase Authentication > Settings > Authorized domains.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
};
const authError = (err: unknown) => {
  const c = (err as { code?: string }).code || '';
  return AUTH_ERRORS[c] || `Sign-in failed: ${(err as Error).message || c}`;
};

/** Email + password. Returns an error message, or '' on success. */
export async function signInWithEmail(email: string, password: string) {
  try { await signInWithEmailAndPassword(auth, email.trim(), password); return ''; }
  catch (err) { return authError(err); }
}
export async function signUpWithEmail(name: string, email: string, password: string) {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (name.trim()) await updateProfile(user, { displayName: name.trim() });
    return '';
  } catch (err) { return authError(err); }
}
export async function resetPassword(email: string) {
  try { await sendPasswordResetEmail(auth, email.trim()); return ''; }
  catch (err) { return authError(err); }
}
export async function signOutUser() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  await signOut(auth);
}
