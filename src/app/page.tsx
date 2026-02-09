"use client";

import { useEffect, useState } from "react";

type GenerateResponse = {
  card_id: string;
  negative: {
    name: string;
    keywords: [string, string];
    interpretation: string;
    image_prompt: string;
    image_url?: string;
  };
  positive: {
    name: string;
    keywords: [string, string];
    interpretation: string;
    image_prompt: string;
    image_url?: string;
  };
  action: {
    title: string;
    minutes: number;
    reason: string;
  };
  status: {
    completed: boolean;
    completed_at: string | null;
  };
};

const USER_ID_KEY = "nega_posi_user_id";

export default function Home() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [data, setData] = useState<GenerateResponse | null>(null);
  const [completed, setCompleted] = useState(false);
  const [imageLoading, setImageLoading] = useState<"negative" | "positive" | null>(null);
  const [history, setHistory] = useState<GenerateResponse[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(USER_ID_KEY);
    if (stored) {
      setUserId(stored);
      return;
    }
    const created = crypto.randomUUID();
    window.localStorage.setItem(USER_ID_KEY, created);
    setUserId(created);
  }, []);

  const onGenerate = async () => {
    setLoading(true);
    setError(null);
    setCompleted(false);
    try {
      if (!userId) {
        throw new Error("ユーザーIDを生成中です。少し待ってから再試行してください。");
      }
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anxiety_text: text, user_id: userId, locale: "ja-JP" }),
      });
      const json = (await res.json()) as GenerateResponse & { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(json.message || "生成に失敗しました");
      }
      setData(json);
      setImageError(null);
      setImageLoading("negative");
      const imageRes = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: json.card_id,
          user_id: userId,
          kind: "negative",
          prompt: json.negative.image_prompt,
        }),
      });
      const imageJson = (await imageRes.json()) as {
        status?: string;
        image_url?: string;
        message?: string;
      };
      if (imageRes.ok && imageJson.image_url) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                negative: { ...prev.negative, image_url: imageJson.image_url },
              }
            : prev
        );
      } else if (!imageRes.ok || imageJson.status === "filtered") {
        setImageError(imageJson.message || "画像生成に失敗しました。後ほど再試行してください。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
      setImageLoading(null);
    }
  };

  const onGeneratePositiveImage = async () => {
    if (!data) return;
    setImageError(null);
    setImageLoading("positive");
    try {
      const imageRes = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: data.card_id,
          user_id: userId,
          kind: "positive",
          prompt: data.positive.image_prompt,
        }),
      });
      const imageJson = (await imageRes.json()) as {
        status?: string;
        image_url?: string;
        message?: string;
      };
      if (imageRes.ok && imageJson.image_url) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                positive: { ...prev.positive, image_url: imageJson.image_url },
              }
            : prev
        );
      } else if (!imageRes.ok || imageJson.status === "filtered") {
        setImageError(imageJson.message || "画像生成に失敗しました。後ほど再試行してください。");
      }
    } finally {
      setImageLoading(null);
    }
  };

  const onComplete = async () => {
    if (!data) return;
    if (!userId) {
      return;
    }
    const res = await fetch("/api/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id: data.card_id, user_id: userId }),
    });
    if (res.ok) {
      setCompleted(true);
    }
  };

  const onToggleHistory = async () => {
    const nextOpen = !historyOpen;
    setHistoryOpen(nextOpen);
    if (!nextOpen) return;
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      if (!userId) {
        throw new Error("ユーザーIDを生成中です。少し待ってから再試行してください。");
      }
      const res = await fetch(`/api/history?user_id=${encodeURIComponent(userId)}`);
      const json = (await res.json()) as { cards?: GenerateResponse[]; message?: string };
      if (!res.ok || !json.cards) {
        throw new Error(json.message || "履歴の取得に失敗しました");
      }
      setHistory(json.cards);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "履歴の取得に失敗しました");
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <main className="mural-bg min-h-screen text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10">
          <p className="text-slate-300">今の不安をひとつだけ書いてください</p>
        </header>

        <section className="mb-10 mural-card rounded-2xl p-6">
          <textarea
            className="w-full rounded-lg border border-slate-700 bg-slate-950/70 p-4 text-slate-100 placeholder:text-slate-500"
            rows={4}
            placeholder="例: 仕事の締切が近いのに手が動かない"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className="rounded-md bg-[#c2a86b] px-4 py-2 text-slate-900 disabled:opacity-50"
              onClick={onGenerate}
              disabled={loading || text.trim().length === 0}
            >
              {loading ? "生成中..." : "カードを引く"}
            </button>
            <button
              className="rounded-md border border-slate-600 px-4 py-2 text-slate-200"
              onClick={onToggleHistory}
            >
              {historyOpen ? "図鑑を閉じる" : "図鑑を見る"}
            </button>
            {error && <span className="text-rose-400">{error}</span>}
          </div>
        </section>

        {data && (
          <section className="grid gap-8 md:grid-cols-2">
            <div className="mural-card rounded-2xl p-6">
              <h2 className="mural-label text-xs">ネガティブカード</h2>
              <div className="mural-frame mt-4 overflow-hidden rounded-2xl" style={{ aspectRatio: "9 / 16" }}>
                {data.negative.image_url ? (
                  <img
                    src={data.negative.image_url}
                    alt={data.negative.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    {imageLoading === "negative" ? "画像を生成中..." : "画像は後ほど生成されます"}
                  </div>
                )}
              </div>
              <div className="mt-3 text-xl font-semibold">{data.negative.name}</div>
              <div className="mt-2 text-slate-300">{data.negative.interpretation}</div>
              <div className="mt-2 text-slate-500">{data.negative.keywords.join(" / ")}</div>
            </div>

            <div className="mural-card rounded-2xl p-6">
              <h2 className="mural-label text-xs">ポジティブカード</h2>
              <div className="mural-frame mt-4 overflow-hidden rounded-2xl" style={{ aspectRatio: "9 / 16" }}>
                {data.positive.image_url ? (
                  <img
                    src={data.positive.image_url}
                    alt={data.positive.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    {imageLoading === "positive" ? "画像を生成中..." : "画像は後ほど生成されます"}
                  </div>
                )}
              </div>
              <div className="mt-3 text-xl font-semibold">{data.positive.name}</div>
              <div className="mt-2 text-slate-300">{data.positive.interpretation}</div>
              <div className="mt-2 text-slate-500">{data.positive.keywords.join(" / ")}</div>
              {!data.positive.image_url && (
                <button
                  className="mt-4 rounded-md border border-[#c2a86b] px-4 py-2 text-[#c2a86b] disabled:opacity-50"
                  onClick={onGeneratePositiveImage}
                  disabled={imageLoading === "positive"}
                >
                  {imageLoading === "positive" ? "生成中..." : "ポジティブカードを呼ぶ"}
                </button>
              )}
            </div>

            <div className="mural-card md:col-span-2 rounded-2xl p-6">
              <h2 className="mural-label text-xs">今日の行動</h2>
              <div className="mt-3 text-xl font-semibold">{data.action.title}</div>
              <div className="mt-1 text-slate-400">所要時間: {data.action.minutes}分</div>
              <div className="mt-2 text-slate-300">{data.action.reason}</div>
              <button
                className="mt-4 rounded-md bg-emerald-300 px-4 py-2 text-emerald-950"
                onClick={onComplete}
              >
                行動できた
              </button>
              {imageError && <div className="mt-2 text-amber-300">{imageError}</div>}
              {completed && <div className="mt-2 text-emerald-300">カードを浄化しました</div>}
            </div>
          </section>
        )}

        {historyOpen && (
          <section className="mt-10">
            <div className="mural-card rounded-2xl p-6">
              <h2 className="mural-label text-xs">カード図鑑</h2>
              {historyLoading && <div className="mt-3 text-slate-400">読み込み中...</div>}
              {historyError && <div className="mt-3 text-rose-400">{historyError}</div>}
              {!historyLoading && !historyError && history.length === 0 && (
                <div className="mt-3 text-slate-400">まだカードがありません</div>
              )}
              {!historyLoading && !historyError && history.length > 0 && (
                <div className="mt-6 grid gap-6 md:grid-cols-3">
                  {history.map((card) => (
                    <div key={card.card_id} className="mural-card rounded-xl p-4">
                      <div className="mural-frame overflow-hidden rounded-xl" style={{ aspectRatio: "9 / 16" }}>
                        {card.negative.image_url ? (
                          <img
                            src={card.negative.image_url}
                            alt={card.negative.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-500">
                            画像なし
                          </div>
                        )}
                      </div>
                      <div className="mt-3 text-base font-semibold">{card.negative.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{card.negative.keywords.join(" / ")}</div>
                      <div className="mt-2 text-xs text-slate-400">
                        {card.status.completed ? "浄化済み" : "未浄化"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
