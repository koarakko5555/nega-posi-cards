import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { GenerateResponse } from "./types";

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const getApp = () => {
  if (getApps().length > 0) return getApps()[0];
  const projectId = requireEnv("GOOGLE_CLOUD_PROJECT");
  return initializeApp({ projectId, credential: applicationDefault() });
};

const getCollection = () => {
  const collection = process.env.FIRESTORE_COLLECTION || "cards";
  return getFirestore(getApp()).collection(collection);
};

export type CardRecord = GenerateResponse & {
  user_id: string;
  anxiety_text: string;
  created_at: FirebaseFirestore.Timestamp;
  image_status?: string;
  image_error?: string | null;
};

export const saveCard = async (record: CardRecord) => {
  await getCollection().doc(record.card_id).set(record);
};

export const updateCardImages = async (cardId: string, userId: string, payload: {
  negative_image_url?: string | null;
  positive_image_url?: string | null;
  image_status?: string;
  image_error?: string | null;
}) => {
  const ref = getCollection().doc(cardId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as CardRecord;
  if (data.user_id !== userId) {
    throw new Error("forbidden");
  }
  const safeNegative =
    payload.negative_image_url && payload.negative_image_url.startsWith("data:")
      ? null
      : payload.negative_image_url;
  const safePositive =
    payload.positive_image_url && payload.positive_image_url.startsWith("data:")
      ? null
      : payload.positive_image_url;

  await ref.update({
    ...(safeNegative !== undefined ? { "negative.image_url": safeNegative } : {}),
    ...(safePositive !== undefined ? { "positive.image_url": safePositive } : {}),
    ...(payload.image_status !== undefined ? { image_status: payload.image_status } : {}),
    ...(payload.image_error !== undefined ? { image_error: payload.image_error } : {}),
  });
  return true;
};

export const completeCard = async (cardId: string, userId: string) => {
  const ref = getCollection().doc(cardId);
  const snap = await ref.get();
  if (!snap.exists) {
    return null;
  }
  const data = snap.data() as CardRecord;
  if (data.user_id !== userId) {
    throw new Error("forbidden");
  }
  const completedAt = Timestamp.now();
  await ref.update({ "status.completed": true, "status.completed_at": completedAt });
  return completedAt.toDate().toISOString();
};

export const getHistory = async (userId: string) => {
  const snap = await getCollection()
    .where("user_id", "==", userId)
    .orderBy("created_at", "desc")
    .limit(50)
    .get();
  return snap.docs.map((doc) => doc.data() as CardRecord);
};
