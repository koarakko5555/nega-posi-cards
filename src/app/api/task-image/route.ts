import { NextResponse } from "next/server";
import { generateImagen } from "@/lib/vertex";
import { updateCalendarTask } from "@/lib/firestore";
import { getOptionalAuthUid } from "@/lib/auth";
import { uploadCardImage } from "@/lib/storage";

type TaskImageRequest = {
  task_id: string;
  user_id: string;
  kind: "negative" | "positive";
  anxiety_text: string;
};

const buildNegativePrompt = (text: string) =>
  `Hand-drawn illustration, modern/anime-inspired style, central symbolic scene that makes the anxiety readable (visual metaphors for ${text}), slightly dark but cute and approachable mood, soft dark base with gentle contrast, painterly shading, 9:16 aspect ratio, highly detailed, no text, no letters, no typography, minimal card framing.`;

const buildPositivePrompt = (text: string) =>
  `Hand-drawn illustration, modern/anime-inspired style, central symbolic scene that embodies relief from ${text}, brighter and cute mood, soft light palette with airy highlights, gentle glow, painterly shading, 9:16 aspect ratio, highly detailed, no text, no letters, no typography, minimal card framing.`;

export async function POST(req: Request) {
  let body: TaskImageRequest;
  try {
    body = (await req.json()) as TaskImageRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.task_id || !body.user_id || !body.kind) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }
  if (!body.anxiety_text || body.anxiety_text.trim().length === 0) {
    return NextResponse.json({ error: "validation_error", message: "不安を入力してください" }, { status: 400 });
  }

  try {
    const uid = await getOptionalAuthUid(req);
    if (uid && body.user_id !== uid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const prompt =
      body.kind === "negative" ? buildNegativePrompt(body.anxiety_text) : buildPositivePrompt(body.anxiety_text);
    const dataUrl = await generateImagen(prompt);
    const imageUrl = await uploadCardImage({
      cardId: body.task_id,
      kind: `task-${body.kind}`,
      dataUrl,
    });
    await updateCalendarTask(body.task_id, body.user_id, {
      ...(body.kind === "negative" ? { negative_image_url: imageUrl } : {}),
      ...(body.kind === "positive" ? { positive_image_url: imageUrl } : {}),
    });
    return NextResponse.json({ status: "ok", image_url: imageUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "image_failed";
    return NextResponse.json({ error: "image_failed", message }, { status: 500 });
  }
}
