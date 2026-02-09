import { GeminiResult } from "./vertex";

type NormalizedGemini = {
  negative: {
    name: string;
    keywords: [string, string];
    interpretation: string;
    emotion: string;
    image_prompt: string;
  };
  positive: {
    name: string;
    keywords: [string, string];
    interpretation: string;
    theme: string;
    image_prompt: string;
  };
  action: {
    title: string;
    minutes: number;
    reason: string;
  };
};

const pickKeywords = (value: unknown): [string, string] | null => {
  if (!Array.isArray(value) || value.length !== 2) return null;
  if (typeof value[0] !== "string" || typeof value[1] !== "string") return null;
  return [value[0], value[1]];
};

const buildNegativePrompt = (emotion: string) =>
  `Hand-drawn tarot card illustration with an antique mural look, warm sepia tones, inked line art, textured parchment, ornate border frame, Japanese text banner, central modern scene that symbolizes ${emotion || "anxiety"}, painterly shading, subtle gold accents, 9:16 aspect ratio, highly detailed.`;

const buildPositivePrompt = (theme: string) =>
  `Hand-drawn tarot card illustration with an antique mural look, warm sepia tones, inked line art, textured parchment, ornate border frame, Japanese text banner, central modern scene that symbolizes ${theme || "hope"}, painterly shading, subtle gold accents, 9:16 aspect ratio, highly detailed.`;

export const normalizeGemini = (input: GeminiResult): NormalizedGemini => {
  const root = (input as any).reflection ?? input;
  const negative = root.negative ?? root.negative_card;
  const positive = root.positive ?? root.positive_card;
  const action = root.action;
  const prompts = root.image_prompts ?? (input as any).image_prompts ?? {};

  if (!negative || !positive || !action) {
    throw new Error(`Missing top-level sections in Gemini output. Payload=${JSON.stringify(input)}`);
  }

  const negativeKeywords = pickKeywords(negative.keywords);
  const positiveKeywords = pickKeywords(positive.keywords);

  const negativePrompt =
    negative.image_prompt ??
    prompts.negative_card_prompt ??
    prompts.negative_prompt ??
    buildNegativePrompt(String(negative.emotion ?? ""));
  const positivePrompt =
    positive.image_prompt ??
    prompts.positive_card_prompt ??
    prompts.positive_prompt ??
    buildPositivePrompt(String(positive.theme ?? ""));

  const isActionString = typeof action === "string";
  const actionTitle = isActionString
    ? action
    : action.title ?? action.description ?? action.action ?? action.task;
  const actionMinutesRaw = isActionString
    ? (action.match(/\d{1,2}/)?.[0] ?? "")
    : action.minutes ?? action.time_minutes ?? action.duration_minutes ?? action.duration;
  const actionMinutes = typeof actionMinutesRaw === "string" ? Number(actionMinutesRaw) : actionMinutesRaw;
  const actionReason = isActionString ? "" : action.reason ?? action.why ?? action.rationale ?? "";

  if (!negative.name || !negative.interpretation || !negativeKeywords || !negativePrompt) {
    throw new Error("Negative card fields missing");
  }
  if (!positive.name || !positive.interpretation || !positiveKeywords || !positivePrompt) {
    throw new Error("Positive card fields missing");
  }
  if (!actionTitle || typeof actionMinutes !== "number" || Number.isNaN(actionMinutes)) {
    throw new Error(`Action fields missing. Payload=${JSON.stringify(input)}`);
  }

  return {
    negative: {
      name: String(negative.name),
      keywords: negativeKeywords,
      interpretation: String(negative.interpretation),
      emotion: String(negative.emotion ?? ""),
      image_prompt: String(negativePrompt),
    },
    positive: {
      name: String(positive.name),
      keywords: positiveKeywords,
      interpretation: String(positive.interpretation),
      theme: String(positive.theme ?? ""),
      image_prompt: String(positivePrompt),
    },
    action: {
      title: String(actionTitle),
      minutes: Number(actionMinutes),
      reason: String(actionReason || "").trim(),
    },
  };
};
