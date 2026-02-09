# Project Rules and Direction

## Scope
This repository targets the hackathon deliverable for a "Negative / Positive Tarot Card" web app that helps users externalize anxiety into cards and convert it into small, actionable steps.

## Hackathon Mandatory Requirements
- Must use at least one Google Cloud application runtime product: App Engine, Google Compute Engine, GKE, Cloud Run, Cloud Functions, or Cloud TPU/GPU.
- Must use at least one Google Cloud AI technology: Vertex AI, Gemini API, Gemma, Imagen, Agent Builder, ADK, Speech-to-Text / Text-to-Speech, Vision AI, Natural Language AI, or Translation AI.

## Optional Technologies (Declare if used)
- Flutter
- Firebase
- Veo

## Submission Checklist
- Public GitHub repository URL (keep public until 2026-03-02).
- Deployed project URL (must be accessible and working through 2026-03-02).
- Zenn article URL with:
  - Category: Idea
  - Topic: gch4
  - Contents: project overview (users, problem, solution), system architecture diagram, ~3 min demo video (YouTube embed).
  - Note: Deployment URL does not need to be in the article.

## Evaluation Criteria
- Novelty of the problem.
- Effectiveness of the solution.
- Implementation quality, scalability, operability, and cost-effectiveness.

## Product Spec (Current Draft)
### Target Users
- 20-40s who feel vague anxiety or self-doubt and want mental care but struggle with consistency.
- People who like tarot/fortune-telling/psychological tests, or struggle with habit apps.

### Problems
- Anxiety loops without clear language.
- Hard to translate into action.
- No sense of accumulating wins.

### Core Concept
"Externalize anxiety into a card, then purify it through action."

### Key Features
- Anxiety input: free text, one theme per entry.
- Negative tarot card generation: name, keywords, gentle interpretation.
- Positive tarot card generation: paired with the negative card, shows a small step forward.
- Action plan: 1 concrete action, 10-15 minutes, no abstract tasks.
- Completion: mark card purified with visual change.
- History/collection: past cards, purified cards, resurfacing reminders.

### Non-Functional Requirements
- Not a daily-streak app. Use only when needed.
- No social sharing or ranking.

## Implementation Direction (To Be Decided)
- Choose Google Cloud runtime (likely Cloud Run for simplicity).
- Choose Google Cloud AI tech (likely Gemini API via Vertex AI).
- Define minimal MVP flow and data model.
- Define privacy boundaries and data retention.

## Workflow Rule
- Do not start implementation until direction is agreed in chat.

## Image Generation Direction (Imagen)
- Use Vertex AI Imagen for card images.
- Negative card style: dark, mystical.
- Positive card style: soft, pale watercolor.
- Aspect ratio: 9:16 (portrait). Closest supported ratio to 2:3 in Imagen 3.
- Generate 1 image per card: negative + positive (2 total per entry).
- Prefer caching generated images to avoid re-generation.

## Imagen Prompt Templates
### Shared World
- Hybrid of modern design and ancient mural aesthetics.
- Moonlight.
- Fresco wall texture.
- Symbolic, non-figurative motifs.
- Avoid existing tarot iconography.

### Negative Card (Dark Mystical)
Template:
Hand-drawn tarot card illustration with an antique mural look, warm sepia tones, inked line art, textured parchment, ornate border frame, Japanese text banner, central modern scene that symbolizes {emotion}, painterly shading, subtle gold accents, 9:16 aspect ratio, highly detailed.

### Positive Card (Soft Watercolor)
Template:
Hand-drawn tarot card illustration with an antique mural look, warm sepia tones, inked line art, textured parchment, ornate border frame, Japanese text banner, central modern scene that symbolizes {positive_theme}, painterly shading, subtle gold accents, 9:16 aspect ratio, highly detailed.

## Prompt Variables
- {emotion}: short English phrase (e.g., rumination, fear, stagnation).
- {negative_name}: Japanese card title.
- {positive_theme}: short English phrase (e.g., small step, flow, acceptance).
- {positive_name}: Japanese card title.

## Gemini Output JSON Schema (Draft)
{
  "negative": {
    "name": "string",
    "keywords": ["string", "string"],
    "interpretation": "string",
    "emotion": "string",
    "image_prompt": "string"
  },
  "positive": {
    "name": "string",
    "keywords": ["string", "string"],
    "interpretation": "string",
    "theme": "string",
    "image_prompt": "string"
  },
  "action": {
    "title": "string",
    "minutes": 10,
    "reason": "string"
  },
  "meta": {
    "language": "ja-JP",
    "safety": {
      "self_harm": false,
      "medical": false
    }
  }
}

## Validation Rules (Draft)
- negative/positive.name: 2-10 Japanese chars (prefer Kanji + Hiragana).
- keywords: exactly 2 entries, each 2-6 Japanese chars.
- interpretation: 30-80 Japanese chars, non-blaming tone.
- emotion/theme: short English phrase (1-3 words).
- image_prompt: long-form template-like prompt that includes "9:16".
- action.minutes: 10-15.
- action.title: 8-20 Japanese chars, concrete action only.
- action.reason: 20-60 Japanese chars.

## Regeneration Policy (Draft)
- JSON parse failure: retry once.
- Rule violation: retry once with targeted fixes.
- Two consecutive failures: fallback to fixed template.

## API Design (MVP)
### POST /api/generate
Request:
- anxiety_text: string (1 topic)
- user_id: string (anonymous UUID)
- locale: string (default ja-JP)

Response:
- card_id: string
- negative: { name, keywords[2], interpretation, emotion, image_prompt, image_url }
- positive: { name, keywords[2], interpretation, theme, image_prompt, image_url }
- action: { title, minutes, reason }
- status: { completed: boolean, completed_at: string|null }

Errors:
- 400: validation_error
- 500: generation_failed

### POST /api/complete
Request:
- card_id: string
- user_id: string

Response:
- status: { completed: true, completed_at: string }

Errors:
- 400: validation_error
- 404: not_found

### GET /api/history
Query:
- user_id: string

Response:
- cards: array of card summaries

## Data Model (Firestore)
Collection: cards
- id: string
- user_id: string
- created_at: timestamp
- anxiety_text: string
- negative: { name, keywords, interpretation, emotion, image_prompt, image_url }
- positive: { name, keywords, interpretation, theme, image_prompt, image_url }
- action: { title, minutes, reason }
- status: { completed: boolean, completed_at: timestamp|null }

## UI Flow (MVP)
1) Input view
- textarea + "カードを引く" button

2) Result view
- Negative card (image + name + interpretation)
- Positive card (image + name + interpretation)
- Action (title + minutes + reason)
- "行動できた" button

3) History view
- Past cards list
- "以前乗り越えたカード" label when resurfaced

## Gemini Prompt (Draft)
System:
You are generating JSON for a Japanese tarot-style reflection app. Return ONLY valid JSON. No extra text.

User:
Given the anxiety text, generate negative card, positive card, and a concrete action. Also generate image prompts for Imagen using the provided templates.
Rules:
- Output must match the JSON schema exactly.
- Card names: 2-10 Japanese chars, avoid existing tarot names.
- keywords: exactly 2 entries, 2-6 Japanese chars each.
- interpretation: 30-80 Japanese chars, non-blaming tone.
- emotion/theme: short English phrase (1-3 words).
- action: concrete, 10-15 minutes, no abstract advice.
- image_prompt: long-form prompt containing "9:16"; follow style rules.
- No self-harm advice. If user mentions self-harm, set meta.safety.self_harm=true and provide gentle non-medical action.

Templates:
Negative:
A portrait tarot card illustration, dark mystical atmosphere, hybrid of modern design and ancient mural aesthetics, moonlight illumination, fresco wall texture, subtle metallic ink, symbolic but non-figurative, negative emotion: {emotion}, card title: "{negative_name}" as small glyph-like typography, no people, no faces, no human figures, 9:16 aspect ratio, high detail, cinematic shadows, desaturated palette with deep indigo and charcoal.

Positive:
A portrait tarot card illustration, soft pale watercolor, hybrid of modern design and ancient mural aesthetics, moonlight glow, fresco wall texture, gentle gradients, symbolic but non-figurative, positive shift: {positive_theme}, card title: "{positive_name}" as small glyph-like typography, no people, no faces, no human figures, 9:16 aspect ratio, airy composition, pastel palette with soft blues and warm ivory.

Return JSON only.

## UX Decisions (MVP)
### Async Strategy
- Use synchronous flow by default.
- If image generation exceeds a threshold (e.g., 8-12 seconds), return text immediately and show "image generating" placeholders.
- Client polls for image readiness via card_id or uses a lightweight status endpoint.

### Error Handling Copy (Japanese)
- Generate failed: "生成に失敗しました。もう一度お試しください。"
- Image delayed: "画像を生成中です。少しだけお待ちください。"
- Network error: "通信に失敗しました。電波の良い場所で再試行してください。"

### UI Copy (MVP)
Input view:
- Title: "不安をカードに変える"
- Placeholder: "今の不安を一つだけ書いてください"
- Button: "カードを引く"

Result view:
- Section labels: "ネガティブカード" / "ポジティブカード" / "今日の行動"
- Action button: "行動できた"
- Completion message: "カードを浄化しました"

History view:
- Title: "これまでのカード"
- Resurface label: "以前乗り越えたカードです"

## Image Generation Execution (Async)
- /api/generate returns text results immediately and stores card with image_status=pending.
- Client triggers /api/images to generate Imagen assets.
- On Imagen quota errors, return text-only and show "later" messaging.
