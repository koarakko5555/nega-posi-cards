"use client";

import { useState } from "react";

type GenerateResponse = {
  card_id: string;
  negative: {
    name: string;
    keywords: [string, string];
    interpretation: string;
    image_url?: string;
  };
  positive: {
    name: string;
    keywords: [string, string];
    interpretation: string;
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

const anonUserId = "anon-demo";

export default function Home() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GenerateResponse | null>(null);
  const [completed, setCompleted] = useState(false);

  const onGenerate = async () => {
    setLoading(true);
    setError(null);
    setCompleted(false);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anxiety_text: text, user_id: anonUserId, locale: "ja-JP" }),
      });
      const json = (await res.json()) as GenerateResponse & { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(json.message || "生成に失敗しました");
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const onComplete = async () => {
    if (!data) return;
    const res = await fetch("/api/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id: data.card_id, user_id: anonUserId }),
    });
    if (res.ok) {
      setCompleted(true);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <header className="mb-10">
          <h1 className="font-display text-3xl font-semibold tracking-wide">不安をカードに変える</h1>
          <p className="mt-2 text-slate-300">今の不安をひとつだけ書いてください</p>
        </header>

        <section className="mb-10">
          <textarea
            className="w-full rounded-lg border border-slate-800 bg-slate-900 p-4 text-slate-100 placeholder:text-slate-500"
            rows={4}
            placeholder="例: 仕事の締切が近いのに手が動かない"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-4 flex items-center gap-3">
            <button
              className="rounded-md bg-slate-100 px-4 py-2 text-slate-900 disabled:opacity-50"
              onClick={onGenerate}
              disabled={loading || text.trim().length === 0}
            >
              {loading ? "生成中..." : "カードを引く"}
            </button>
            {error && <span className="text-rose-400">{error}</span>}
          </div>
        </section>

        {data && (
          <section className="grid gap-8 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-sm uppercase tracking-widest text-slate-400">ネガティブカード</h2>
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60" style={{ aspectRatio: "9 / 16" }}>
                {data.negative.image_url ? (
                  <img
                    src={data.negative.image_url}
                    alt={data.negative.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">画像を生成中...</div>
                )}
              </div>
              <div className="mt-3 text-xl font-semibold">{data.negative.name}</div>
              <div className="mt-2 text-slate-300">{data.negative.interpretation}</div>
              <div className="mt-2 text-slate-500">{data.negative.keywords.join(" / ")}</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-sm uppercase tracking-widest text-slate-400">ポジティブカード</h2>
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60" style={{ aspectRatio: "9 / 16" }}>
                {data.positive.image_url ? (
                  <img
                    src={data.positive.image_url}
                    alt={data.positive.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">画像を生成中...</div>
                )}
              </div>
              <div className="mt-3 text-xl font-semibold">{data.positive.name}</div>
              <div className="mt-2 text-slate-300">{data.positive.interpretation}</div>
              <div className="mt-2 text-slate-500">{data.positive.keywords.join(" / ")}</div>
            </div>

            <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-sm uppercase tracking-widest text-slate-400">今日の行動</h2>
              <div className="mt-3 text-xl font-semibold">{data.action.title}</div>
              <div className="mt-1 text-slate-400">所要時間: {data.action.minutes}分</div>
              <div className="mt-2 text-slate-300">{data.action.reason}</div>
              <button
                className="mt-4 rounded-md bg-emerald-400 px-4 py-2 text-emerald-950"
                onClick={onComplete}
              >
                行動できた
              </button>
              {completed && <div className="mt-2 text-emerald-300">カードを浄化しました</div>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
