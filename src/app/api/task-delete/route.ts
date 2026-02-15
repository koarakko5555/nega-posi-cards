import { NextResponse } from "next/server";
import { clearCardSchedule, deleteCalendarTask } from "@/lib/firestore";
import { getOptionalAuthUid } from "@/lib/auth";

type TaskDeleteRequest = {
  kind: "card" | "task";
  user_id: string;
  card_id?: string;
  task_id?: string;
};

export async function POST(req: Request) {
  let body: TaskDeleteRequest;
  try {
    body = (await req.json()) as TaskDeleteRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.user_id || body.kind === undefined) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  try {
    const uid = await getOptionalAuthUid(req);
    if (uid && body.user_id !== uid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const updated =
      body.kind === "card"
        ? await clearCardSchedule(body.card_id || "", body.user_id)
        : await deleteCalendarTask(body.task_id || "", body.user_id);
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "delete_failed";
    return NextResponse.json({ error: "delete_failed", message }, { status: 500 });
  }
}
