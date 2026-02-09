import { NextResponse } from "next/server";
import { updateCardImages } from "@/lib/firestore";
import { generateImagen } from "@/lib/vertex";

const isMock = () => process.env.MOCK_GENERATION === "true";

type ImageRequest = {
  card_id: string;
  user_id: string;
  kind: "negative" | "positive";
  prompt: string;
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
    return NextResponse.json({ status: "mock" });
  }

  try {
    const imageUrl = await generateImagen(body.prompt);
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
