import { NextResponse } from "next/server";
import { updateActionPlan } from "@/lib/firestore";

type RegisterRequest = {
  card_id: string;
  user_id: string;
  scheduled_date: string;
  action_title: string;
  action_reason: string;
  action_minutes?: number;
};

export async function POST(req: Request) {
  let body: RegisterRequest;
  try {
    body = (await req.json()) as RegisterRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    !body.card_id ||
    !body.user_id ||
    !body.scheduled_date ||
    !body.action_title ||
    !body.action_reason
  ) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  try {
    const updated = await updateActionPlan(body.card_id, body.user_id, {
      title: body.action_title,
      reason: body.action_reason,
      minutes: body.action_minutes,
      scheduled_date: body.scheduled_date,
      checklist_done: false,
      checklist_done_at: null,
    });
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ status: "registered", scheduled_date: body.scheduled_date });
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "register_failed";
    return NextResponse.json({ error: "register_failed", message }, { status: 500 });
  }
}
