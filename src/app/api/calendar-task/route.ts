import { NextResponse } from "next/server";
import { createCalendarTask } from "@/lib/firestore";
import { randomUUID } from "crypto";
import { Timestamp } from "firebase-admin/firestore";

type CalendarTaskRequest = {
  user_id: string;
  scheduled_date: string;
  action_title: string;
};

export async function POST(req: Request) {
  let body: CalendarTaskRequest;
  try {
    body = (await req.json()) as CalendarTaskRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.user_id || !body.scheduled_date || !body.action_title) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  const id = randomUUID();
  try {
    await createCalendarTask({
      id,
      user_id: body.user_id,
      scheduled_date: body.scheduled_date,
      action_title: body.action_title,
      checklist_done: false,
      created_at: Timestamp.now(),
    });
    return NextResponse.json({ status: "created", task_id: id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "calendar_task_failed";
    return NextResponse.json({ error: "calendar_task_failed", message }, { status: 500 });
  }
}
