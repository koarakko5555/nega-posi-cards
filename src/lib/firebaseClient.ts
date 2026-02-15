import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

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
