import { getAuth } from "firebase-admin/auth";
import { getApp } from "./firestore";

export const getAuthUid = async (req: Request): Promise<string> => {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new Error("unauthorized");
  }
  const token = header.replace("Bearer ", "").trim();
  if (!token) {
    throw new Error("unauthorized");
  }
  const auth = getAuth(getApp());
  const decoded = await auth.verifyIdToken(token);
  return decoded.uid;
};

export const getOptionalAuthUid = async (req: Request): Promise<string | null> => {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }
  const token = header.replace("Bearer ", "").trim();
  if (!token) {
    return null;
  }
  const auth = getAuth(getApp());
  const decoded = await auth.verifyIdToken(token);
  return decoded.uid;
};
