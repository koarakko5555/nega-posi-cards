import { NextResponse } from "next/server";
import { getHistory, getLatestSelfImage, saveSelfImage } from "@/lib/firestore";
import { generateImagen, generateSelfImagePrompt } from "@/lib/vertex";
import { uploadCardImage } from "@/lib/storage";
import { getAuthUid } from "@/lib/auth";
import { randomUUID } from "crypto";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(req: Request) {
  let body: { user_id?: string };
  try {
    body = (await req.json()) as { user_id?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.user_id) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  try {
    const uid = await getAuthUid(req);
    if (uid !== body.user_id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const history = await getHistory(body.user_id);
    if (history.length === 0) {
      return NextResponse.json({ error: "no_history", message: "カードがまだありません" }, { status: 400 });
    }

    const lines = history.slice(0, 20).map((card, index) => {
      const negative = card.negative?.emotion ?? "";
      const positive = card.positive?.theme ?? "";
      const actionTitle = card.action?.title ?? "";
      const actionReason = card.action?.reason ?? "";
      const anxiety = card.anxiety_text ?? "";
      return `${index + 1}. anxiety: ${anxiety}; negative: ${negative}; positive: ${positive}; action: ${actionTitle}; detail: ${actionReason}`;
    });

    const summary = lines.join("\n");
    const promptResult = await generateSelfImagePrompt(summary);
    const dataUrl = await generateImagen(promptResult.image_prompt);
    const imageUrl = await uploadCardImage({
      cardId: `self-${body.user_id}-${Date.now()}`,
      kind: "self-state",
      dataUrl,
    });

    await saveSelfImage({
      id: randomUUID(),
      user_id: body.user_id,
      image_url: imageUrl,
      description: promptResult.description,
      created_at: Timestamp.now(),
    });

    return NextResponse.json({ image_url: imageUrl, description: promptResult.description });
  } catch (error) {
    const message = error instanceof Error ? error.message : "self_image_failed";
    return NextResponse.json({ error: "self_image_failed", message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id") || "";
  if (!userId) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }
  try {
    const uid = await getAuthUid(req);
    if (uid !== userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const record = await getLatestSelfImage(userId);
    if (!record) {
      return NextResponse.json({ image_url: null, description: null });
    }
    return NextResponse.json({
      image_url: record.image_url,
      description: record.description,
      created_at: record.created_at.toDate().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "self_image_failed";
    console.error("self_image_failed", {
      message,
      userId,
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      firestoreProjectId: process.env.FIREBASE_PROJECT_ID,
      databaseId: process.env.FIRESTORE_DATABASE_ID || "(default)",
    });
    if (message === "unauthorized") {
      return NextResponse.json({ error: "unauthorized", message }, { status: 401 });
    }
    return NextResponse.json({ error: "self_image_failed", message }, { status: 500 });
  }
}
