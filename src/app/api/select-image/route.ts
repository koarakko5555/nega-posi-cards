import { NextResponse } from "next/server";
import { updateCardImages } from "@/lib/firestore";

type SelectImageRequest = {
  card_id: string;
  user_id: string;
  image_url: string;
};

export async function POST(req: Request) {
  let body: SelectImageRequest;
  try {
    body = (await req.json()) as SelectImageRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.card_id || !body.user_id || !body.image_url) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  try {
    const updated = await updateCardImages(body.card_id, body.user_id, {
      negative_image_url: body.image_url,
      image_status: "selected",
      image_error: null,
    });
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ status: "selected", image_url: body.image_url });
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "select_failed";
    return NextResponse.json({ error: "select_failed", message }, { status: 500 });
  }
}
