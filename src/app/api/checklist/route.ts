import { NextResponse } from "next/server";
import { updateActionPlan, updateCalendarTask } from "@/lib/firestore";
import { getOptionalAuthUid } from "@/lib/auth";

type ChecklistRequest = {
  card_id: string;
  task_id?: string;
  user_id: string;
  done: boolean;
};

export async function POST(req: Request) {
  let body: ChecklistRequest;
  try {
    body = (await req.json()) as ChecklistRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if ((!body.card_id && !body.task_id) || !body.user_id || typeof body.done !== "boolean") {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  try {
    const uid = await getOptionalAuthUid(req);
    if (uid && body.user_id !== uid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const updated = body.task_id
      ? await updateCalendarTask(body.task_id, body.user_id, {
          checklist_done: body.done,
        })
      : await updateActionPlan(body.card_id, body.user_id, {
          checklist_done: body.done,
          checklist_done_at: body.done ? new Date().toISOString() : null,
        });
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ status: "ok", done: body.done });
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "checklist_failed";
    return NextResponse.json({ error: "checklist_failed", message }, { status: 500 });
  }
}
