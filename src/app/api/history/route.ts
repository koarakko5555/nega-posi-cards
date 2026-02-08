import { NextResponse } from "next/server";
import { mockHistory } from "@/lib/mock";
import { getHistory } from "@/lib/firestore";

const isMock = () => process.env.MOCK_GENERATION === "true";

export async function GET(req: Request) {
  if (isMock()) {
    return NextResponse.json({ cards: mockHistory() });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "validation_error", message: "user_id is required" }, { status: 400 });
  }

  try {
    const cards = await getHistory(userId);
    return NextResponse.json({ cards });
  } catch (error) {
    return NextResponse.json({ error: "history_failed" }, { status: 500 });
  }
}
