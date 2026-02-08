import { NextResponse } from "next/server";
import { CompleteRequest } from "@/lib/types";
import { validateCompleteRequest } from "@/lib/validation";
import { completeCard } from "@/lib/firestore";

export async function POST(req: Request) {
  let body: CompleteRequest;
  try {
    body = (await req.json()) as CompleteRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const validation = validateCompleteRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: "validation_error", message: validation.message }, { status: 400 });
  }

  try {
    const completedAt = await completeCard(body.card_id, body.user_id);
    if (!completedAt) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({
      status: {
        completed: true,
        completed_at: completedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "completion_failed" }, { status: 500 });
  }
}
