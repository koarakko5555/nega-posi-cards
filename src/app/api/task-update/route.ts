import { NextResponse } from "next/server";
import { updateCalendarTask, updateCardDetails } from "@/lib/firestore";
import { getOptionalAuthUid } from "@/lib/auth";

type TaskUpdateRequest = {
  kind: "card" | "task";
  user_id: string;
  card_id?: string;
  task_id?: string;
  action_title: string;
  action_detail: string;
  anxiety_text: string;
};

export async function POST(req: Request) {
  let body: TaskUpdateRequest;
  try {
    body = (await req.json()) as TaskUpdateRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.user_id || !body.action_title) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  try {
    const uid = await getOptionalAuthUid(req);
    if (uid && body.user_id !== uid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const updated =
      body.kind === "card"
        ? await updateCardDetails(body.card_id || "", body.user_id, {
            action_title: body.action_title,
            action_reason: body.action_detail,
            anxiety_text: body.anxiety_text,
          })
        : await updateCalendarTask(body.task_id || "", body.user_id, {
            action_title: body.action_title,
            action_detail: body.action_detail,
            anxiety_text: body.anxiety_text,
          });
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "update_failed";
    return NextResponse.json({ error: "update_failed", message }, { status: 500 });
  }
}
