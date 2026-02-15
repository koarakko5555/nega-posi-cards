import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInAnonymously, type Auth, type User } from "firebase/auth";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

const getFirebaseConfig = (): FirebaseConfig | null => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }
  return { apiKey, authDomain, projectId, appId };
};

export const hasFirebaseConfig = () => Boolean(getFirebaseConfig());

const getApp = () => {
  const config = getFirebaseConfig();
  if (!config) return null;
  return getApps().length > 0 ? getApps()[0] : initializeApp(config);
};

export const getFirebaseAuth = () => {
  const app = getApp();
  return app ? getAuth(app) : null;
};

export const getGoogleProvider = () => new GoogleAuthProvider();

export type AnonymousResult = {
  user: User | null;
  errorCode?: string;
  errorMessage?: string;
};

export const ensureAnonymousUser = async (auth: Auth | null): Promise<AnonymousResult> => {
  if (!auth) return { user: null, errorCode: "auth/not-initialized", errorMessage: "auth not initialized" };
  if (auth.currentUser) return { user: auth.currentUser };
  try {
    const result = await signInAnonymously(auth);
    return { user: result.user };
  } catch (error) {
    const message = error instanceof Error ? error.message : "anonymous_failed";
    const codeMatch = message.match(/auth\/[a-zA-Z-]+/);
    return { user: null, errorCode: codeMatch?.[0], errorMessage: message };
  }
};
