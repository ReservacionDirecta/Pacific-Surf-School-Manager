import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Sheets scope
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

const STORAGE_KEY = 'google_sheets_token';

function saveToken(token: string) {
  cachedAccessToken = token;
  try { sessionStorage.setItem(STORAGE_KEY, token); } catch { /* ignore */ }
}

function restoreToken(): string | null {
  const stored = cachedAccessToken;
  if (stored) return stored;
  try {
    const t = sessionStorage.getItem(STORAGE_KEY);
    if (t) { cachedAccessToken = t; return t; }
  } catch { /* ignore */ }
  return null;
}

function clearToken() {
  cachedAccessToken = null;
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      const token = restoreToken();
      if (token) {
        if (onAuthSuccess) onAuthSuccess(user, token);
        return;
      }
      if (!isSigningIn) {
        clearToken();
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      clearToken();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    saveToken(credential.accessToken);
    return { user: result.user, accessToken: cachedAccessToken! };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return restoreToken();
};

export const logoutGoogle = async () => {
  await auth.signOut();
  clearToken();
};
