import { NextResponse } from "next/server";
import { getCalendarItems, getCalendarTasks } from "@/lib/firestore";
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
        image_url: record.negative?.image_url ?? null,
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
        image_url: null,
      }));
    return NextResponse.json({ items: [...cardItems, ...taskItems] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "calendar_failed";
    return NextResponse.json({ error: "calendar_failed", message }, { status: 500 });
  }
}
