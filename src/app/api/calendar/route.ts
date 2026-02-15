import { NextResponse } from "next/server";
import { getCalendarItems, getCalendarTasks } from "@/lib/firestore";
import { getOptionalAuthUid } from "@/lib/auth";
import type { CalendarItem } from "@/lib/types";

const pad = (value: number) => String(value).padStart(2, "0");

const toMonthRange = (monthKey: string) => {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month || month < 1 || month > 12) {
    return null;
  }
  const start = `${year}-${pad(month)}-01`;
  const endDate = new Date(year, month, 0);
  const end = `${year}-${pad(month)}-${pad(endDate.getDate())}`;
  return { start, end };
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  const month = searchParams.get("month");
  if (!userId || !month) {
    return NextResponse.json({ error: "validation_error", message: "user_id and month are required" }, { status: 400 });
  }
  const range = toMonthRange(month);
  if (!range) {
    return NextResponse.json({ error: "validation_error", message: "month format must be YYYY-MM" }, { status: 400 });
  }

  try {
    const uid = await getOptionalAuthUid(req);
    if (uid && userId !== uid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    console.log("calendar_debug", {
      userId,
      month,
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      firestoreProjectId: process.env.FIREBASE_PROJECT_ID,
      databaseId: process.env.FIRESTORE_DATABASE_ID,
      collection: process.env.FIRESTORE_COLLECTION,
    });
    const [records, tasks] = await Promise.all([getCalendarItems(userId), getCalendarTasks(userId)]);
    const cardItems: CalendarItem[] = records
      .filter((record) => {
        if (!record.action?.scheduled_date) return false;
        return record.action.scheduled_date >= range.start && record.action.scheduled_date <= range.end;
      })
      .map((record) => ({
        kind: "card",
        id: record.card_id,
        card_id: record.card_id,
        scheduled_date: record.action.scheduled_date as string,
        action_title: record.action.title,
        checklist_done: Boolean(record.action.checklist_done),
        image_url: record.action?.image_url ?? record.negative?.image_url ?? null,
        negative_image_url: record.negative?.image_url ?? null,
        positive_image_url: record.positive?.image_url ?? null,
        action_detail: record.action.reason ?? "",
        anxiety_text: record.anxiety_text ?? "",
      }));
    const taskItems: CalendarItem[] = tasks
      .filter((task) => task.scheduled_date >= range.start && task.scheduled_date <= range.end)
      .map((task) => ({
        kind: "task",
        id: task.id,
        task_id: task.id,
        scheduled_date: task.scheduled_date,
        action_title: task.action_title,
        checklist_done: Boolean(task.checklist_done),
        image_url: task.negative_image_url ?? null,
        negative_image_url: task.negative_image_url ?? null,
        positive_image_url: task.positive_image_url ?? null,
        action_detail: task.action_detail ?? "",
        anxiety_text: task.anxiety_text ?? "",
      }));
    return NextResponse.json({ items: [...cardItems, ...taskItems] });
  } catch (error) {
    console.error("calendar_failed", {
      message: error instanceof Error ? error.message : error,
      userId,
      month,
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      firestoreProjectId: process.env.FIREBASE_PROJECT_ID,
      databaseId: process.env.FIRESTORE_DATABASE_ID,
      collection: process.env.FIRESTORE_COLLECTION,
    });
    const message = error instanceof Error ? error.message : "calendar_failed";
    return NextResponse.json({ error: "calendar_failed", message }, { status: 500 });
  }
}
