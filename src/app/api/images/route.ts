import { NextResponse } from "next/server";
import { updateCardImages } from "@/lib/firestore";
import { uploadCardImage } from "@/lib/storage";
import { generateImagen } from "@/lib/vertex";

const isMock = () => process.env.MOCK_GENERATION === "true";

type ImageRequest = {
  card_id: string;
  user_id: string;
  kind: "negative" | "positive" | "negative_candidate";
  prompt: string;
  candidate_index?: number;
};

export async function POST(req: Request) {
  let body: ImageRequest;
  try {
    body = (await req.json()) as ImageRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.card_id || !body.user_id || !body.kind || !body.prompt) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  if (isMock()) {
    return NextResponse.json({
      status: "mock",
      image_url: "/file.svg",
      candidate_index: body.candidate_index ?? 0,
    });
  }

  try {
    const dataUrl = await generateImagen(body.prompt);
    const kindLabel =
      body.kind === "negative_candidate"
        ? `negative-candidate-${typeof body.candidate_index === "number" ? body.candidate_index + 1 : 1}`
        : body.kind;
    const imageUrl = await uploadCardImage({
      cardId: body.card_id,
      kind: kindLabel,
      dataUrl,
    });

    if (body.kind === "negative_candidate") {
      return NextResponse.json({
        status: "candidate_ready",
        image_url: imageUrl,
        candidate_index: body.candidate_index ?? 0,
      });
    }

    await updateCardImages(body.card_id, body.user_id, {
      ...(body.kind === "negative" ? { negative_image_url: imageUrl } : {}),
      ...(body.kind === "positive" ? { positive_image_url: imageUrl } : {}),
      image_status: body.kind === "positive" ? "ready" : "partial",
      image_error: null,
    });

    return NextResponse.json({
      status: body.kind === "positive" ? "ready" : "partial",
      image_url: imageUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "image_generation_failed";
    const isFiltered = message.includes("raiFilteredReason");
    await updateCardImages(body.card_id, body.user_id, {
      image_status: isFiltered ? "filtered" : "error",
      image_error: message,
    });
    if (isFiltered) {
      return NextResponse.json({ status: "filtered", message: "画像が安全フィルタでブロックされました。" });
    }
    return NextResponse.json({ error: "image_generation_failed", message }, { status: 500 });
  }
}
