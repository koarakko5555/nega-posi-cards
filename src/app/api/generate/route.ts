import { NextResponse } from "next/server";
import { GenerateRequest } from "@/lib/types";
import { validateGenerateRequest } from "@/lib/validation";
import { mockGenerate } from "@/lib/mock";
import { generateWithGemini } from "@/lib/vertex";
import { normalizeGemini } from "@/lib/normalize";
import { randomUUID } from "crypto";
import { saveCard } from "@/lib/firestore";
import { Timestamp } from "firebase-admin/firestore";

const isMock = () => process.env.MOCK_GENERATION === "true";

export async function POST(req: Request) {
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const validation = validateGenerateRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: "validation_error", message: validation.message }, { status: 400 });
  }

  if (isMock()) {
    return NextResponse.json(mockGenerate(body));
  }

  try {
    const gemini = await generateWithGemini(body.anxiety_text);
    const normalized = normalizeGemini(gemini);

    const response = {
      card_id: randomUUID(),
      negative: { ...normalized.negative, image_url: null },
      positive: { ...normalized.positive, image_url: null },
      action: normalized.action,
      status: { completed: false, completed_at: null },
    };

    await saveCard({
      ...response,
      user_id: body.user_id,
      anxiety_text: body.anxiety_text,
      created_at: Timestamp.now(),
      image_status: "pending",
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "generation_failed";
    return NextResponse.json({ error: "generation_failed", message }, { status: 500 });
  }
}
