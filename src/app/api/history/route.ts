import { NextResponse } from "next/server";
import { getHistory, getRecentCards } from "@/lib/firestore";
import { getOptionalAuthUid } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const isPublic = searchParams.get("public") === "1";
  const userId = searchParams.get("user_id") || "";
  if (!isPublic && !userId) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  try {
    let history;
    if (isPublic) {
      history = await getRecentCards(20);
    } else {
      const uid = await getOptionalAuthUid(req);
      if (uid && uid !== userId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      history = await getHistory(userId);
    }
    const items = history.slice(0, 20).map((card) => ({
      card_id: card.card_id,
      negative_image_url: card.negative?.image_url ?? null,
      positive_image_url: card.positive?.image_url ?? null,
      created_at: card.created_at?.toDate?.().toISOString?.() ?? null,
    }));
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "history_failed";
    return NextResponse.json({ error: "history_failed", message }, { status: 500 });
  }
}
