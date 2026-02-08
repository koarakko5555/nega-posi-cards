import { NextResponse } from "next/server";
import { updateCardImages } from "@/lib/firestore";
import { generateImagen } from "@/lib/vertex";

const isMock = () => process.env.MOCK_GENERATION === "true";

type ImageRequest = {
  card_id: string;
  user_id: string;
  negative_prompt: string;
  positive_prompt: string;
};

export async function POST(req: Request) {
  let body: ImageRequest;
  try {
    body = (await req.json()) as ImageRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.card_id || !body.user_id || !body.negative_prompt || !body.positive_prompt) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  if (isMock()) {
    return NextResponse.json({ status: "mock" });
  }

  try {
    const [negativeImage, positiveImage] = await Promise.all([
      generateImagen(body.negative_prompt),
      generateImagen(body.positive_prompt),
    ]);

    await updateCardImages(body.card_id, body.user_id, {
      negative_image_url: negativeImage,
      positive_image_url: positiveImage,
      image_status: "ready",
      image_error: null,
    });

    return NextResponse.json({
      status: "ready",
      negative_image_url: negativeImage,
      positive_image_url: positiveImage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "image_generation_failed";
    await updateCardImages(body.card_id, body.user_id, {
      image_status: "error",
      image_error: message,
    });
    return NextResponse.json({ error: "image_generation_failed", message }, { status: 500 });
  }
}
