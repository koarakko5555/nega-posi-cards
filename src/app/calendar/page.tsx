"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFirebaseAuth, getGoogleProvider, hasFirebaseConfig, ensureAnonymousUser } from "@/lib/firebaseClient";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";

type CalendarItem = {
  kind: "card" | "task";
  id: string;
  card_id?: string;
  task_id?: string;
  scheduled_date: string;
  action_title: string;
  action_detail?: string;
  anxiety_text?: string;
  checklist_done: boolean;
  image_url?: string | null;
  negative_image_url?: string | null;
  positive_image_url?: string | null;
};

const WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const pad = (value: number) => String(value).padStart(2, "0");
const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const buildCalendar = (base: Date) => {
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const cells: Array<{ day: number | null; isToday: boolean; dateKey?: string }> = [];
  const today = new Date();
  const isSameMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = isSameMonth ? today.getDate() : -1;

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ day: null, isToday: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${pad(month + 1)}-${pad(day)}`;
    cells.push({ day, isToday: day === todayDate, dateKey });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, isToday: false });
  }
  return { year, month, cells };
};

export default function CalendarPage() {
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(formatDateKey(new Date()));
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<CalendarItem | null>(null);
  const [editAnxiety, setEditAnxiety] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDetail, setEditDetail] = useState("");
  const [editNegativeUrl, setEditNegativeUrl] = useState<string | null>(null);
  const [editPositiveUrl, setEditPositiveUrl] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editGenerating, setEditGenerating] = useState<"negative" | "positive" | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState<Date>(() => new Date());
  const calendar = buildCalendar(activeMonth);
  const overlayOpen = editOpen;

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserId(null);
        setIdToken(null);
        await ensureAnonymousUser(auth);
        return;
      }
      const token = await user.getIdToken();
      setUserId(user.uid);
      setIdToken(token);
    });
    return () => unsub();
  }, []);

  const onLogin = async () => {
    setAuthError(null);
    try {
      if (!hasFirebaseConfig()) {
        setAuthError("Firebaseの設定が読み込めていません。");
        return;
      }
      const auth = getFirebaseAuth();
      if (!auth) {
        setAuthError("Firebaseの設定が読み込めていません。");
        return;
      }
      await signInWithPopup(auth, getGoogleProvider());
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "ログインに失敗しました");
    }
  };

  const onLogout = async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signOut(auth);
  };

  const monthKey = `${calendar.year}-${pad(calendar.month + 1)}`;
  const authHeader: HeadersInit | undefined = idToken ? { Authorization: `Bearer ${idToken}` } : undefined;

  const loadCalendar = async (targetUserId: string) => {
    setCalendarError(null);
    setCalendarLoading(true);
    try {
      const res = await fetch(`/api/calendar?user_id=${encodeURIComponent(targetUserId)}&month=${monthKey}`, {
        headers: authHeader,
      });
      const json = (await res.json()) as { items?: CalendarItem[]; message?: string };
      if (!res.ok || !json.items) {
        throw new Error(json.message || "カレンダーの取得に失敗しました");
      }
      setCalendarItems(json.items);
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : "カレンダーの取得に失敗しました");
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    loadCalendar(userId);
  }, [userId, monthKey]);

  useEffect(() => {
    const key = `${calendar.year}-${pad(calendar.month + 1)}`;
    if (!selectedDate.startsWith(key)) {
      setSelectedDate(`${key}-01`);
    }
  }, [calendar.year, calendar.month, selectedDate]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = overlayOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [overlayOpen]);

  const onToggleChecklistItem = async (item: CalendarItem, done: boolean) => {
    if (!userId) return;
    try {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader ?? {}) },
        body: JSON.stringify({
          card_id: item.kind === "card" ? item.card_id : undefined,
          task_id: item.kind === "task" ? item.task_id : undefined,
          user_id: userId,
          done,
        }),
      });
      if (res.ok) {
        setCalendarItems((prev) =>
          prev.map((entry) => (entry.id === item.id ? { ...entry, checklist_done: done } : entry))
        );
      }
    } catch {
      // no-op
    }
  };

  const openEditModal = (item: CalendarItem) => {
    setEditItem(item);
    setEditAnxiety(item.anxiety_text ?? "");
    setEditTitle(item.action_title ?? "");
    setEditDetail(item.action_detail ?? "");
    setEditNegativeUrl(item.negative_image_url ?? item.image_url ?? null);
    setEditPositiveUrl(item.positive_image_url ?? item.image_url ?? null);
    setEditError(null);
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    if (!editItem || !userId) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch("/api/task-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader ?? {}) },
        body: JSON.stringify({
          kind: editItem.kind,
          user_id: userId,
          card_id: editItem.card_id,
          task_id: editItem.task_id,
          action_title: editTitle,
          action_detail: editDetail,
          anxiety_text: editAnxiety,
        }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { message?: string };
        throw new Error(json.message || "更新に失敗しました");
      }
      await loadCalendar(userId);
      setEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setEditSaving(false);
    }
  };

  const onDeleteItem = async (item: CalendarItem) => {
    if (!userId) return;
    try {
      const res = await fetch("/api/task-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader ?? {}) },
        body: JSON.stringify({
          kind: item.kind,
          user_id: userId,
          card_id: item.card_id,
          task_id: item.task_id,
        }),
      });
      if (res.ok) {
        await loadCalendar(userId);
      }
    } catch {
      // no-op
    }
  };

  const onGenerateEditImage = async (kind: "negative" | "positive") => {
    if (!editItem || !userId) return;
    if (!editAnxiety.trim()) {
      setEditError("不安を入力してください");
      return;
    }
    if (editItem.kind !== "task" || !editItem.task_id) {
      return;
    }
    setEditGenerating(kind);
    setEditError(null);
    try {
      const res = await fetch("/api/task-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader ?? {}) },
        body: JSON.stringify({
          task_id: editItem.task_id,
          user_id: userId,
          kind,
          anxiety_text: editAnxiety,
        }),
      });
      const json = (await res.json()) as { image_url?: string; message?: string };
      if (!res.ok) {
        throw new Error(json.message || "画像生成に失敗しました");
      }
      if (kind === "negative") {
        setEditNegativeUrl(json.image_url ?? null);
      } else {
        setEditPositiveUrl(json.image_url ?? null);
      }
      await loadCalendar(userId);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "画像生成に失敗しました");
    } finally {
      setEditGenerating(null);
    }
  };

  const itemsByDate = calendarItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.scheduled_date] = (acc[item.scheduled_date] || 0) + 1;
    return acc;
  }, {});
  const tasksByDate = calendarItems.reduce<Record<string, CalendarItem[]>>((acc, item) => {
    if (!acc[item.scheduled_date]) {
      acc[item.scheduled_date] = [];
    }
    acc[item.scheduled_date].push(item);
    return acc;
  }, {});
  const selectedItems = calendarItems.filter((item) => item.scheduled_date === selectedDate);
  const getNegativeImage = (item: CalendarItem) => {
    if (item.kind !== "card") {
      return item.negative_image_url || item.image_url || item.positive_image_url || "/calendar-default.svg";
    }
    return item.negative_image_url || item.image_url || item.positive_image_url || "/calendar-default.svg";
  };
  const getPositiveImage = (item: CalendarItem) => {
    if (item.kind !== "card") {
      return item.positive_image_url || item.image_url || item.negative_image_url || "/calendar-default.svg";
    }
    return item.positive_image_url || item.image_url || item.negative_image_url || "/calendar-default.svg";
  };
  const completedCount = selectedItems.filter((item) => item.checklist_done).length;
  const totalCount = selectedItems.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <main className="mural-bg min-h-screen text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-100">Beyond Anxiety Cards</h1>
              <nav className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href="/"
                  className="rounded-full border border-slate-600 px-3 py-1 text-slate-200"
                >
                  不安を言葉にしましょう
                </Link>
                <Link
                  href="/calendar"
                  className="rounded-full border border-emerald-300 bg-emerald-300 px-3 py-1 text-emerald-950"
                >
                  不安から一歩踏み出しましょう
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              {userId ? (
                <button
                  className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200"
                  onClick={onLogout}
                >
                  ログアウト
                </button>
              ) : (
                <button
                  className="rounded-md bg-emerald-300 px-3 py-2 text-sm text-emerald-950"
                  onClick={onLogin}
                >
                  Googleでログイン
                </button>
              )}
            </div>
          </div>
          {authError && <p className="mt-2 text-sm text-rose-400">{authError}</p>}
        </header>

        <section className="mb-10 grid gap-6">
          <div className="mural-card rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
              <span>今日がんばってみること（{selectedDate}）</span>
              <span>
                {completedCount}/{totalCount}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800">
              <div
                className="h-2 rounded-full bg-emerald-300 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {calendarLoading && <div className="mt-2 text-sm text-slate-400">読み込み中...</div>}
            {calendarError && <div className="mt-2 text-sm text-rose-400">{calendarError}</div>}
            {!calendarLoading && !calendarError && selectedItems.length === 0 && (
              <div className="mt-2 text-sm text-slate-500">登録された行動はありません</div>
            )}
            {!calendarLoading && !calendarError && selectedItems.length > 0 && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {selectedItems.map((item) => (
                  <label
                    key={item.id}
                    className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={item.checklist_done}
                      onChange={(e) => onToggleChecklistItem(item, e.target.checked)}
                      className="absolute left-3 top-3 z-10 h-4 w-4"
                    />
                    <div className="relative h-28 w-full overflow-hidden">
                      <div
                        className="absolute inset-0"
                        style={{ clipPath: "polygon(0 0, 65% 0, 38% 100%, 0 100%)" }}
                      >
                        <img
                          src={getNegativeImage(item)}
                          alt="ネガティブ画像"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div
                        className="absolute inset-0"
                        style={{ clipPath: "polygon(65% 0, 100% 0, 100% 100%, 38% 100%)" }}
                      >
                        <img
                          src={getPositiveImage(item)}
                          alt="ポジティブ画像"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="absolute -top-8 left-[51%] h-48 w-0.5 -translate-x-1/2 -rotate-[75deg] bg-white/70 shadow-[0_0_8px_rgba(255,255,255,0.45)]" />
                      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    </div>
                    <div className="px-3 pb-3 pt-2">
                      <div
                        className={`line-clamp-2 ${
                          item.checklist_done ? "line-through text-slate-500" : "text-slate-100"
                        }`}
                      >
                        {item.action_title}
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openEditModal(item);
                            }}
                            className="rounded-full border border-slate-600 bg-slate-900/80 px-2 py-1 text-[12px] text-slate-200"
                            aria-label="編集"
                          >
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onDeleteItem(item);
                            }}
                            className="rounded-full border border-rose-500/60 bg-rose-500/10 px-2 py-1 text-[12px] text-rose-200"
                            aria-label="削除"
                          >
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M8 6v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mural-card rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm tracking-[0.2em] text-slate-400">カレンダー</div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <button
                  className="rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-300"
                  onClick={() =>
                    setActiveMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }
                >
                  &lt;
                </button>
                <span>
                  {calendar.year}年 {calendar.month + 1}月
                </span>
                <button
                  className="rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-300"
                  onClick={() =>
                    setActiveMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }
                >
                  &gt;
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 text-xs text-slate-500">
              {WEEK_LABELS.map((label) => (
                <div key={label} className="text-center">
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-7 gap-2 text-sm">
              {calendar.cells.map((cell, index) => (
                <button
                  key={`${cell.day ?? "x"}-${index}`}
                  type="button"
                  onClick={() => cell.dateKey && setSelectedDate(cell.dateKey)}
                  disabled={!cell.day}
                  className={`flex h-16 items-start justify-center rounded-lg px-1 pb-1 pt-2 text-left transition ${
                    cell.dateKey === selectedDate
                      ? "bg-emerald-300 text-slate-900 ring-2 ring-emerald-200"
                      : cell.isToday
                        ? "bg-amber-200 text-slate-900 ring-1 ring-amber-300"
                        : cell.day
                          ? itemsByDate[cell.dateKey || ""]
                            ? "bg-slate-900/70 text-slate-100"
                            : "bg-slate-900/40 text-slate-200"
                          : "text-slate-700"
                  }`}
                >
                  <div className="flex h-full w-full flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className={cell.isToday && cell.dateKey !== selectedDate ? "font-semibold" : ""}>
                        {cell.day ?? ""}
                      </span>
                      {cell.day && itemsByDate[cell.dateKey || ""] ? (
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            cell.isToday && cell.dateKey !== selectedDate ? "bg-emerald-700" : "bg-emerald-300"
                          }`}
                        />
                      ) : null}
                    </div>
                    <div
                      className={`space-y-0.5 text-[10px] ${
                        cell.dateKey === selectedDate
                          ? "text-slate-800"
                          : cell.isToday
                            ? "text-slate-700"
                            : "text-slate-300"
                      }`}
                    >
                      {(tasksByDate[cell.dateKey || ""] || []).slice(0, 2).map((item) => (
                        <div key={item.id} className="truncate">
                          {item.action_title}
                        </div>
                      ))}
                      {(tasksByDate[cell.dateKey || ""] || []).length > 2 && (
                        <div className="text-[9px] opacity-70">
                          +{tasksByDate[cell.dateKey || ""].length - 2}件
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {editOpen && editItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
            <div className="w-full max-w-3xl rounded-3xl border border-slate-700 bg-slate-950/95 p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm tracking-[0.3em] text-slate-400">やることを編集</div>
                <button
                  className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300"
                  onClick={() => setEditOpen(false)}
                >
                  閉じる
                </button>
              </div>
              <div className="grid gap-4">
                <div>
                  <div className="text-xs text-slate-400">不安</div>
                  <textarea
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-slate-100"
                    rows={3}
                    value={editAnxiety}
                    onChange={(e) => setEditAnxiety(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-400">画像（ネガティブ）</div>
                    <div className="mural-frame mt-2 overflow-hidden rounded-2xl" style={{ aspectRatio: "9 / 16" }}>
                      <img
                        src={editNegativeUrl || "/calendar-default.svg"}
                        alt="ネガティブ画像"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    {editItem.kind === "task" && (
                      <button
                        className="mt-2 rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200"
                        onClick={() => onGenerateEditImage("negative")}
                        disabled={editGenerating === "negative"}
                      >
                        {editGenerating === "negative" ? "生成中..." : "ネガ画像を生成"}
                      </button>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">画像（ポジティブ）</div>
                    <div className="mural-frame mt-2 overflow-hidden rounded-2xl" style={{ aspectRatio: "9 / 16" }}>
                      <img
                        src={editPositiveUrl || "/calendar-default.svg"}
                        alt="ポジティブ画像"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    {editItem.kind === "task" && (
                      <button
                        className="mt-2 rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-200"
                        onClick={() => onGenerateEditImage("positive")}
                        disabled={editGenerating === "positive"}
                      >
                        {editGenerating === "positive" ? "生成中..." : "ポジ画像を生成"}
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">タイトル</div>
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-slate-100"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-xs text-slate-400">詳細</div>
                  <textarea
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-slate-100"
                    rows={4}
                    value={editDetail}
                    onChange={(e) => setEditDetail(e.target.value)}
                  />
                </div>
                {editError && <div className="text-sm text-rose-400">{editError}</div>}
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-md bg-emerald-300 px-4 py-2 text-emerald-950 disabled:opacity-50"
                    onClick={onSaveEdit}
                    disabled={editSaving || editTitle.trim().length === 0}
                  >
                    {editSaving ? "保存中..." : "保存する"}
                  </button>
                  <button
                    className="rounded-md border border-slate-600 px-4 py-2 text-slate-200"
                    onClick={() => setEditOpen(false)}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
