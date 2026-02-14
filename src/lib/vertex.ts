import { GoogleAuth } from "google-auth-library";

export type GeminiResult = {
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
  meta?: {
    language?: string;
    safety?: { self_harm?: boolean; medical?: boolean };
  };
};

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

const getAccessToken = async (): Promise<string> => {
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse || !tokenResponse.token) {
    throw new Error("Failed to acquire access token");
  }
  return tokenResponse.token;
};

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const buildGeminiPrompt = (anxietyText: string): string => {
  return `You are generating JSON for a Japanese tarot-style reflection app. Return ONLY valid JSON. No extra text.

Given the anxiety text, generate negative card, positive card, and a concrete action. Also generate image prompts for Imagen using the provided templates.
Rules:
- Output must match the JSON schema exactly.
- Card names: 2-10 Japanese chars, avoid existing tarot names.
- keywords: exactly 2 entries, 2-6 Japanese chars each.
- interpretation: 30-80 Japanese chars, non-blaming tone.
- emotion/theme: short English phrase (1-3 words).
- action: concrete, 10-15 minutes, no abstract advice.
- action.title: short and clearly understandable. Must be title-only (no detail text).
- action.reason: write the detail (separate from title).
- action.minutes: required (10-15).
- image_prompt: long-form prompt containing "9:16"; follow style rules.
- No self-harm advice. If user mentions self-harm, set meta.safety.self_harm=true and provide gentle non-medical action.

Templates:
Negative:
Hand-drawn illustration, modern/anime-inspired style, central symbolic scene that makes the anxiety readable (visual metaphors for {emotion}), slightly dark but cute and approachable mood (about 0.85), soft dark base with gentle contrast, painterly shading, 9:16 aspect ratio, highly detailed, no text, no letters, no typography, minimal card framing, pop-art color pops, silhouettes or human shadow allowed.

Positive:
Hand-drawn illustration, modern/anime-inspired style, central symbolic scene that embodies {positive_theme}, brighter and cuter mood (about 1.15), soft light palette with airy highlights, gentle glow, painterly shading, 9:16 aspect ratio, highly detailed, no text, no letters, no typography, minimal card framing.

Anxiety text:
${anxietyText}`;
};

const extractJson = (text: string): string => {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("No JSON object found in Gemini response");
  }
  return text.slice(first, last + 1);
};

export const generateWithGemini = async (anxietyText: string): Promise<GeminiResult> => {
  const project = requireEnv("GOOGLE_CLOUD_PROJECT");
  const location = requireEnv("GOOGLE_CLOUD_LOCATION");
  const model = requireEnv("VERTEX_AI_MODEL_GEMINI");
  const token = await getAccessToken();
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildGeminiPrompt(anxietyText) }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${errorText}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part.text ?? "").join("").trim();
  if (!text) {
    throw new Error(`Gemini response missing text: ${JSON.stringify(data)}`);
  }

  const jsonText = extractJson(text);
  return JSON.parse(jsonText) as GeminiResult;
};

export const generateImagen = async (prompt: string): Promise<string> => {
  const project = requireEnv("GOOGLE_CLOUD_PROJECT");
  const location = requireEnv("GOOGLE_CLOUD_LOCATION");
  const model = requireEnv("VERTEX_AI_MODEL_IMAGEN");
  const token = await getAccessToken();
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "9:16",
        personGeneration: "allow",
        includeRaiReason: true,
        language: "en",
        outputOptions: {
          mimeType: "image/png",
        },
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Imagen API error: ${res.status} ${errorText}`);
  }

  const data = (await res.json()) as {
    predictions?: Array<{ bytesBase64Encoded?: string; raiFilteredReason?: string }>;
    error?: { message?: string };
  };
  const prediction = data.predictions?.[0];
  const base64 = prediction?.bytesBase64Encoded;
  if (!base64) {
    const payload = JSON.stringify(data);
    throw new Error(`Imagen response missing image bytes: ${payload}`);
  }

  return `data:image/png;base64,${base64}`;
};
