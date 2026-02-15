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

export const getApp = () => {
  if (getApps().length > 0) return getApps()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || requireEnv("GOOGLE_CLOUD_PROJECT");
  return initializeApp({ projectId, credential: applicationDefault() });
};

const getCollection = () => {
  const collection = process.env.FIRESTORE_COLLECTION || "cards";
  const databaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";
  return getFirestore(getApp(), databaseId).collection(collection);
};

export type CardRecord = GenerateResponse & {
  user_id: string;
  anxiety_text: string;
  created_at: FirebaseFirestore.Timestamp;
  image_status?: string;
  image_error?: string | null;
};

export type CalendarTaskRecord = {
  id: string;
  user_id: string;
  scheduled_date: string;
  action_title: string;
  action_detail?: string | null;
  anxiety_text?: string | null;
  negative_image_url?: string | null;
  positive_image_url?: string | null;
  checklist_done: boolean;
  created_at: FirebaseFirestore.Timestamp;
};

export type SelfImageRecord = {
  id: string;
  user_id: string;
  image_url: string;
  description: string;
  created_at: FirebaseFirestore.Timestamp;
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
  await ref.update({
    ...(payload.negative_image_url !== undefined ? { "negative.image_url": payload.negative_image_url } : {}),
    ...(payload.positive_image_url !== undefined ? { "positive.image_url": payload.positive_image_url } : {}),
    ...(payload.image_status !== undefined ? { image_status: payload.image_status } : {}),
    ...(payload.image_error !== undefined ? { image_error: payload.image_error } : {}),
  });
  return true;
};

export const updateActionPlan = async (
  cardId: string,
  userId: string,
  payload: {
    title?: string;
    reason?: string;
    minutes?: number;
    scheduled_date?: string | null;
    image_url?: string | null;
    checklist_done?: boolean;
    checklist_done_at?: string | null;
  }
) => {
  const ref = getCollection().doc(cardId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as CardRecord;
  if (data.user_id !== userId) {
    throw new Error("forbidden");
  }
  await ref.update({
    ...(payload.title !== undefined ? { "action.title": payload.title } : {}),
    ...(payload.reason !== undefined ? { "action.reason": payload.reason } : {}),
    ...(payload.minutes !== undefined ? { "action.minutes": payload.minutes } : {}),
    ...(payload.scheduled_date !== undefined ? { "action.scheduled_date": payload.scheduled_date } : {}),
    ...(payload.image_url !== undefined ? { "action.image_url": payload.image_url } : {}),
    ...(payload.checklist_done !== undefined ? { "action.checklist_done": payload.checklist_done } : {}),
    ...(payload.checklist_done_at !== undefined ? { "action.checklist_done_at": payload.checklist_done_at } : {}),
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

export const getRecentCards = async (limit = 20) => {
  const snap = await getCollection()
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((doc) => doc.data() as CardRecord);
};

export const getCalendarItems = async (userId: string) => {
  const snap = await getCollection()
    .where("user_id", "==", userId)
    .orderBy("created_at", "desc")
    .limit(300)
    .get();
  return snap.docs.map((doc) => doc.data() as CardRecord);
};

const getTaskCollection = () => getFirestore(getApp()).collection("calendar_tasks");
const getSelfImageCollection = () => getFirestore(getApp()).collection("self_images");

export const createCalendarTask = async (record: CalendarTaskRecord) => {
  await getTaskCollection().doc(record.id).set(record);
};

export const getCalendarTasks = async (userId: string) => {
  const snap = await getTaskCollection()
    .where("user_id", "==", userId)
    .limit(300)
    .get();
  return snap.docs.map((doc) => doc.data() as CalendarTaskRecord);
};

export const updateCalendarTask = async (
  taskId: string,
  userId: string,
  payload: {
    checklist_done?: boolean;
    action_title?: string;
    action_detail?: string | null;
    anxiety_text?: string | null;
    negative_image_url?: string | null;
    positive_image_url?: string | null;
  }
) => {
  const ref = getTaskCollection().doc(taskId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as CalendarTaskRecord;
  if (data.user_id !== userId) {
    throw new Error("forbidden");
  }
  await ref.update({
    ...(payload.checklist_done !== undefined ? { checklist_done: payload.checklist_done } : {}),
    ...(payload.action_title !== undefined ? { action_title: payload.action_title } : {}),
    ...(payload.action_detail !== undefined ? { action_detail: payload.action_detail } : {}),
    ...(payload.anxiety_text !== undefined ? { anxiety_text: payload.anxiety_text } : {}),
    ...(payload.negative_image_url !== undefined ? { negative_image_url: payload.negative_image_url } : {}),
    ...(payload.positive_image_url !== undefined ? { positive_image_url: payload.positive_image_url } : {}),
  });
  return true;
};

export const deleteCalendarTask = async (taskId: string, userId: string) => {
  const ref = getTaskCollection().doc(taskId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as CalendarTaskRecord;
  if (data.user_id !== userId) {
    throw new Error("forbidden");
  }
  await ref.delete();
  return true;
};

export const saveSelfImage = async (record: SelfImageRecord) => {
  await getSelfImageCollection().doc(record.id).set(record);
};

export const getLatestSelfImage = async (userId: string) => {
  const snap = await getSelfImageCollection()
    .where("user_id", "==", userId)
    .orderBy("created_at", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data() as SelfImageRecord;
};

export const updateCardDetails = async (
  cardId: string,
  userId: string,
  payload: { action_title?: string; action_reason?: string; anxiety_text?: string }
) => {
  const ref = getCollection().doc(cardId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as CardRecord;
  if (data.user_id !== userId) {
    throw new Error("forbidden");
  }
  await ref.update({
    ...(payload.action_title !== undefined ? { "action.title": payload.action_title } : {}),
    ...(payload.action_reason !== undefined ? { "action.reason": payload.action_reason } : {}),
    ...(payload.anxiety_text !== undefined ? { anxiety_text: payload.anxiety_text } : {}),
  });
  return true;
};

export const clearCardSchedule = async (cardId: string, userId: string) => {
  const ref = getCollection().doc(cardId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as CardRecord;
  if (data.user_id !== userId) {
    throw new Error("forbidden");
  }
  await ref.update({
    "action.scheduled_date": null,
    "action.checklist_done": false,
    "action.checklist_done_at": null,
  });
  return true;
};
