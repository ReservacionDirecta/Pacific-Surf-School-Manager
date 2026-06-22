import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let tokenTimestamp = 0;

const STORAGE_KEY = 'google_sheets_token';
const STORAGE_TIME_KEY = 'google_sheets_token_time';
// Google access tokens expire after 60 min — refresh after 50 min
const TOKEN_EXPIRY_MS = 50 * 60 * 1000;

type AuthListener = (token: string | null) => void;
let listeners: AuthListener[] = [];

export function addAuthListener(fn: AuthListener) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

function notifyListeners(token: string | null) {
  listeners.forEach(fn => fn(token));
}

function saveToken(token: string) {
  cachedAccessToken = token;
  tokenTimestamp = Date.now();
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
    sessionStorage.setItem(STORAGE_TIME_KEY, String(tokenTimestamp));
  } catch { /* ignore */ }
  notifyListeners(token);
}

function restoreToken(): { token: string; isExpired: boolean } | null {
  if (cachedAccessToken) {
    return { token: cachedAccessToken, isExpired: Date.now() - tokenTimestamp > TOKEN_EXPIRY_MS };
  }
  try {
    const t = sessionStorage.getItem(STORAGE_KEY);
    const ts = Number(sessionStorage.getItem(STORAGE_TIME_KEY)) || 0;
    if (t) {
      cachedAccessToken = t;
      tokenTimestamp = ts || Date.now();
      return { token: t, isExpired: Date.now() - tokenTimestamp > TOKEN_EXPIRY_MS };
    }
  } catch { /* ignore */ }
  return null;
}

function clearToken() {
  cachedAccessToken = null;
  tokenTimestamp = 0;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_TIME_KEY);
  } catch { /* ignore */ }
  notifyListeners(null);
}

let refreshPromise: Promise<string | null> | null = null;

// Attempt silent token refresh via signInWithPopup.
// If user already granted scopes, the popup auto-closes immediately.
async function refreshTokenSilently(): Promise<string | null> {
  if (isSigningIn) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      isSigningIn = true;
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        saveToken(credential.accessToken);
        return credential.accessToken;
      }
      return null;
    } catch (e: any) {
      // Popup blocked or user dismissed — not fatal
      console.warn('Silent token refresh did not succeed:', e?.code || e?.message || e);
      return null;
    } finally {
      isSigningIn = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// Initialize auth listener.
// Calls onAuthSuccess() only when a VALID (non-expired) token exists.
// Calls onAuthFailure() when:
//   - No user is signed in
//   - Token is expired and silent refresh failed
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      const cached = restoreToken();
      if (cached && !cached.isExpired) {
        if (onAuthSuccess) onAuthSuccess(user, cached.token);
        return;
      }
      // Token expired or missing — try silent refresh
      if (!isSigningIn) {
        refreshTokenSilently().then(fresh => {
          if (fresh && onAuthSuccess) {
            onAuthSuccess(user, fresh);
          } else if (onAuthFailure) {
            clearToken();
            onAuthFailure();
          }
        });
      }
    } else {
      clearToken();
      if (onAuthFailure) onAuthFailure();
    }
  });
  return unsubscribe;
};

// Must be called from a button click (user gesture) to avoid popup blocking
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
  const cached = restoreToken();
  if (cached && !cached.isExpired) return cached.token;
  // Expired — try silent refresh for synchronous callers
  if (cached?.token) {
    const fresh = await refreshTokenSilently();
    if (fresh) return fresh;
  }
  return cached?.token ?? null;
};

// Force a new token — used by sheetsSync on 401 for automatic retry
export const forceRefreshToken = async (): Promise<string | null> => {
  return refreshTokenSilently();
};

export const logoutGoogle = async () => {
  await auth.signOut();
  clearToken();
};
