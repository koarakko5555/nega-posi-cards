import { CompleteRequest, GenerateRequest } from "./types";

type ValidationResult = { ok: true } | { ok: false; message: string };

const MAX_TEXT_LENGTH = 300;
const MIN_TEXT_LENGTH = 1;

export const validateGenerateRequest = (input: GenerateRequest): ValidationResult => {
  if (typeof input.anxiety_text !== "string") {
    return { ok: false, message: "anxiety_text is required" };
  }
  const trimmed = input.anxiety_text.trim();
  if (trimmed.length < MIN_TEXT_LENGTH) {
    return { ok: false, message: "anxiety_text is empty" };
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return { ok: false, message: "anxiety_text is too long" };
  }
  if (typeof input.user_id !== "string" || input.user_id.trim().length === 0) {
    return { ok: false, message: "user_id is required" };
  }
  return { ok: true };
};

export const validateCompleteRequest = (input: CompleteRequest): ValidationResult => {
  if (typeof input.card_id !== "string" || input.card_id.trim().length === 0) {
    return { ok: false, message: "card_id is required" };
  }
  if (typeof input.user_id !== "string" || input.user_id.trim().length === 0) {
    return { ok: false, message: "user_id is required" };
  }
  return { ok: true };
};
