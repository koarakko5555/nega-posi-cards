"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth, getGoogleProvider, hasFirebaseConfig } from "@/lib/firebaseClient";
import type { GenerateResponse } from "@/lib/types";

const pad = (value: number) => String(value).padStart(2, "0");
const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const buildInitialCandidates = (count: number) => Array.from({ length: count }, () => null as string | null);

export default function DrawPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialText = useMemo(() => searchParams.get("text") ?? "", [searchParams]);

  const [userId, setUserId] = useState<string | null>(null);
  const [anonId, setAnonId] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [anxietyText, setAnxietyText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GenerateResponse | null>(null);

  const [candidateUrls, setCandidateUrls] = useState<Array<string | null>>(() => buildInitialCandidates(3));
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  const [actionTitle, setActionTitle] = useState("");
  const [actionDetail, setActionDetail] = useState("");
  const [actionMinutes, setActionMinutes] = useState<number | undefined>(undefined);
  const [actionImageUrl, setActionImageUrl] = useState<string | null>(null);
  const [actionImageLoading, setActionImageLoading] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(formatDateKey(new Date()));
  const [registering, setRegistering] = useState(false);
  const [registeredDate, setRegisteredDate] = useState<string | null>(null);
  const [autoRan, setAutoRan] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserId(null);
        setIdToken(null);
        return;
      }
      const token = await user.getIdToken();
      setUserId(user.uid);
      setIdToken(token);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("nega_posi_anon_id");
    if (stored) {
      setAnonId(stored);
      return;
    }
    const created = crypto.randomUUID();
    window.localStorage.setItem("nega_posi_anon_id", created);
    setAnonId(created);
  }, []);

  const effectiveUserId = userId ?? anonId;

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

  const authHeader = idToken ? { Authorization: `Bearer ${idToken}` } : {};

  const generateCard = async () => {
    if (!effectiveUserId) {
      setError("ユーザーIDを生成中です。少し待ってから再試行してください。");
      return;
    }
    const trimmed = anxietyText.trim();
    if (!trimmed) {
      setError("不安を入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    setSelectedUrl(null);
    setRegisteredDate(null);
    setCandidateUrls(buildInitialCandidates(3));
    setActionImageUrl(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ anxiety_text: trimmed, user_id: effectiveUserId, locale: "ja-JP" }),
      });
      const json = (await res.json()) as GenerateResponse & { message?: string };
      if (!res.ok) {
        throw new Error(json.message || "生成に失敗しました");
      }
      setData(json);
      setActionTitle(json.action.title);
      setActionDetail(json.action.reason);
      setActionMinutes(json.action.minutes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!autoRan && effectiveUserId && initialText.trim() && !loading && !data) {
      setAutoRan(true);
      setAnxietyText(initialText);
      void generateCard();
    }
  }, [autoRan, userId, initialText, loading, data]);

  useEffect(() => {
    if (!data || !effectiveUserId) return;
    let cancelled = false;
    const run = async () => {
      setCandidateLoading(true);
      try {
        await Promise.all(
          candidateUrls.map(async (_item, index) => {
            try {
              const res = await fetch("/api/images", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader },
                body: JSON.stringify({
                  card_id: data.card_id,
                  user_id: effectiveUserId,
                  kind: "negative_candidate",
                  prompt: data.negative.image_prompt,
                  candidate_index: index,
                }),
              });
              const json = (await res.json()) as { image_url?: string; message?: string };
              if (!res.ok) {
                throw new Error(json.message || "画像生成に失敗しました");
              }
              if (!cancelled) {
                setCandidateUrls((prev) => {
                  const next = [...prev];
                  next[index] = json.image_url ?? null;
                  return next;
                });
              }
            } catch {
              // skip failed candidate
            }
          })
        );
      } finally {
        if (!cancelled) {
          setCandidateLoading(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [data, userId]);

  useEffect(() => {
    if (!data || !effectiveUserId) return;
    let cancelled = false;
    const run = async () => {
      setActionImageLoading(true);
      try {
        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({
            card_id: data.card_id,
            user_id: effectiveUserId,
            kind: "positive",
            prompt: data.positive.image_prompt,
          }),
        });
        const json = (await res.json()) as { image_url?: string; message?: string };
        if (!res.ok) {
          throw new Error(json.message || "画像生成に失敗しました");
        }
        if (!cancelled) {
          setActionImageUrl(json.image_url ?? null);
        }
      } catch {
        if (!cancelled) {
          setActionImageUrl(null);
        }
      } finally {
        if (!cancelled) {
          setActionImageLoading(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [data, userId]);

  const onSelectCandidate = async (url: string) => {
    if (!data || !effectiveUserId) return;
    setSelectedUrl(url);
    try {
      await fetch("/api/select-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ card_id: data.card_id, user_id: effectiveUserId, image_url: url }),
      });
    } catch {
      // no-op
    }
  };

  const onRegister = async () => {
    if (!data || !effectiveUserId) return;
    if (!selectedUrl) {
      setError("画像を選択してください");
      return;
    }
    if (!actionTitle.trim() || !actionDetail.trim()) {
      setError("タイトルと詳細を入力してください");
      return;
    }
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          card_id: data.card_id,
          user_id: effectiveUserId,
          scheduled_date: scheduledDate,
          action_title: actionTitle.trim(),
          action_reason: actionDetail.trim(),
          action_minutes: actionMinutes,
          action_image_url: actionImageUrl,
        }),
      });
      const json = (await res.json()) as { message?: string; scheduled_date?: string };
      if (!res.ok) {
        throw new Error(json.message || "登録に失敗しました");
      }
      setRegisteredDate(json.scheduled_date ?? scheduledDate);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setRegistering(false);
    }
  };

  useEffect(() => {
    if (initialText && !anxietyText) {
      setAnxietyText(initialText);
    }
  }, [initialText, anxietyText]);

  return (
    <main className="mural-bg min-h-screen text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-100">Beyond Anxiety Cards</h1>
            <p className="mt-2 text-slate-300">不安をカード化して行動につなげます</p>
            <nav className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Link
                href="/"
                className="rounded-full border border-slate-600 px-3 py-1 text-slate-200"
              >
                不安を言葉にしましょう
              </Link>
              <Link
                href="/calendar"
                className="rounded-full border border-slate-600 px-3 py-1 text-slate-200"
              >
                不安から一歩踏み出しましょう
              </Link>
            </nav>
          </div>
          <div>
            {userId ? (
              <span className="text-sm text-emerald-300">ログイン中</span>
            ) : (
              <button
                className="rounded-md bg-emerald-300 px-3 py-2 text-sm text-emerald-950"
                onClick={onLogin}
              >
                Googleでログイン
              </button>
            )}
          </div>
        </header>
        {authError && <p className="text-sm text-rose-400">{authError}</p>}

        <section className="mural-card rounded-2xl p-6">
          <div className="mb-2 text-sm tracking-[0.2em] text-slate-400">今の不安をひとつだけ書いてください</div>
          <div className="mb-4 text-xs text-slate-500">不安の入力</div>
          <textarea
            className="w-full rounded-lg border border-slate-700 bg-slate-950/70 p-4 text-slate-100 placeholder:text-slate-500"
            rows={4}
            value={anxietyText}
            onChange={(e) => setAnxietyText(e.target.value)}
            placeholder="今の不安をひとつだけ書いてください"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className="rounded-md bg-[#c2a86b] px-4 py-2 text-slate-900 disabled:opacity-50"
              onClick={generateCard}
              disabled={loading || !effectiveUserId}
            >
              {loading ? "生成中..." : "カードを引く"}
            </button>
            {!effectiveUserId && <span className="text-sm text-slate-400">準備中...</span>}
            {error && <span className="text-rose-400">{error}</span>}
          </div>
        </section>

        {data && (
          <section className="grid gap-6">
            <div className="mural-card rounded-2xl p-6">
              <div className="mb-4 text-sm tracking-[0.2em] text-slate-400">
                あなたの不安を一番表現できている1枚を選んでください
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {candidateUrls.map((url, index) => {
                  const selected = url && selectedUrl === url;
                  return (
                    <button
                      key={`${url ?? "candidate"}-${index}`}
                      type="button"
                      onClick={() => url && onSelectCandidate(url)}
                      className={`mural-frame relative overflow-hidden rounded-2xl transition ${
                        selected ? "ring-4 ring-emerald-300" : "ring-1 ring-transparent"
                      }`}
                      style={{ aspectRatio: "9 / 16" }}
                    >
                      {url ? (
                        <img src={url} alt={`候補${index + 1}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                          {candidateLoading ? "生成中..." : "画像を生成できませんでした"}
                        </div>
                      )}
                      {selected && <div className="absolute inset-0 border-2 border-emerald-200" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mural-card rounded-2xl p-6">
              <div className="mb-4 text-sm tracking-[0.2em] text-slate-400">不安を解消しましょう</div>
              <div className="grid gap-5 md:grid-cols-[200px_1fr]">
                <div>
                  <div className="mural-frame overflow-hidden rounded-2xl" style={{ aspectRatio: "9 / 16" }}>
                    {actionImageUrl ? (
                      <img src={actionImageUrl} alt="行動のイメージ" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                        {actionImageLoading ? "生成中..." : "画像を生成できませんでした"}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid gap-4">
                  <div>
                    <div className="text-xs text-slate-400">タイトル</div>
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-slate-100"
                      value={actionTitle}
                      onChange={(e) => setActionTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">詳細</div>
                    <textarea
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-slate-100"
                      rows={4}
                      value={actionDetail}
                      onChange={(e) => setActionDetail(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs text-slate-400">
                      日付
                      <input
                        type="date"
                        className="ml-2 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-sm text-slate-100"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                      />
                    </label>
                    <button
                      className="rounded-md bg-emerald-300 px-4 py-2 text-emerald-950 disabled:opacity-50"
                      onClick={onRegister}
                      disabled={registering}
                    >
                      {registering ? "登録中..." : "カレンダーに登録"}
                    </button>
                    {registeredDate && (
                      <span className="text-sm text-emerald-300">
                        {registeredDate} に登録しました
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
