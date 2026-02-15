"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signInWithPopup, type User } from "firebase/auth";
import { getFirebaseAuth, getGoogleProvider, hasFirebaseConfig, ensureAnonymousUser } from "@/lib/firebaseClient";
import type { GenerateResponse } from "@/lib/types";

const pad = (value: number) => String(value).padStart(2, "0");
const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const buildInitialCandidates = (count: number) => Array.from({ length: count }, () => null as string | null);
const buildInitialErrors = (count: number) => Array.from({ length: count }, () => null as string | null);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryImage = (status: number, message?: string) => {
  if (status === 429) return true;
  if (!message) return false;
  return (
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("Quota exceeded") ||
    message.includes("429")
  );
};

const fetchImageWithRetry = async (
  payload: Record<string, unknown>,
  getAuthHeader: (force?: boolean) => Promise<HeadersInit | undefined>,
  maxRetries = 2
): Promise<{ imageUrl?: string; message?: string }> => {
  let lastMessage = "画像を生成できませんでした";
  let lastStatus = 0;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const authHeader = await getAuthHeader(attempt > 0);
    const res = await fetch("/api/images", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(authHeader ?? {}) },
      body: JSON.stringify(payload),
    });
    lastStatus = res.status;
    const json = (await res.json().catch(() => ({}))) as { image_url?: string; message?: string; error?: string };
    const message = json.message || json.error || lastMessage;
    lastMessage = message;
    if (res.ok && json.image_url) {
      return { imageUrl: json.image_url };
    }
    if (res.ok) {
      return { message };
    }
    if (message.includes("auth/id-token-expired") && attempt < maxRetries) {
      await wait(400);
      continue;
    }
    if (shouldRetryImage(lastStatus, message) && attempt < maxRetries) {
      await wait(900 + attempt * 800);
      continue;
    }
    return { message };
  }
  return { message: lastMessage };
};

function DrawPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialText = useMemo(() => searchParams.get("text") ?? "", [searchParams]);

  const [userId, setUserId] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [anxietyText, setAnxietyText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GenerateResponse | null>(null);

  const [candidateUrls, setCandidateUrls] = useState<Array<string | null>>(() => buildInitialCandidates(3));
  const [candidateErrors, setCandidateErrors] = useState<Array<string | null>>(() => buildInitialErrors(3));
  const [candidateBusy, setCandidateBusy] = useState<Array<boolean>>(() => Array(3).fill(false));
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  const [actionTitle, setActionTitle] = useState("");
  const [actionDetail, setActionDetail] = useState("");
  const [actionMinutes, setActionMinutes] = useState<number | undefined>(undefined);
  const [actionImageUrl, setActionImageUrl] = useState<string | null>(null);
  const [actionImageLoading, setActionImageLoading] = useState(false);
  const [actionImageError, setActionImageError] = useState<string | null>(null);
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
        setAuthUser(null);
        await ensureAnonymousUser(auth);
        return;
      }
      setUserId(user.uid);
      setAuthUser(user);
    });
    return () => unsub();
  }, []);
  const effectiveUserId = userId;

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

  const getAuthHeader = async (force = false): Promise<HeadersInit | undefined> => {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser ?? authUser;
    if (!user) return undefined;
    const token = await user.getIdToken(force);
    return { Authorization: `Bearer ${token}` };
  };

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
    setCandidateErrors(buildInitialErrors(3));
    setCandidateBusy(Array(3).fill(false));
    setActionImageUrl(null);
    setActionImageError(null);

    try {
      const authHeader = await getAuthHeader();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader ?? {}) },
        body: JSON.stringify({ anxiety_text: trimmed, user_id: effectiveUserId, locale: "ja-JP" }),
      });
      const json = (await res.json()) as GenerateResponse & { message?: string };
      if (!res.ok) {
        if (json.message?.includes("auth/id-token-expired")) {
          const refreshed = await getAuthHeader(true);
          const retry = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(refreshed ?? {}) },
            body: JSON.stringify({ anxiety_text: trimmed, user_id: effectiveUserId, locale: "ja-JP" }),
          });
          const retryJson = (await retry.json()) as GenerateResponse & { message?: string };
          if (!retry.ok) {
            throw new Error(retryJson.message || "生成に失敗しました");
          }
          setData(retryJson);
          setActionTitle(retryJson.action.title);
          setActionDetail(retryJson.action.reason);
          setActionMinutes(retryJson.action.minutes);
          return;
        }
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
        for (let index = 0; index < candidateUrls.length; index += 1) {
          if (cancelled) break;
          try {
            if (!cancelled) {
              setCandidateBusy((prev) => {
                const next = [...prev];
                next[index] = true;
                return next;
              });
            }
            const result = await fetchImageWithRetry(
              {
                card_id: data.card_id,
                user_id: effectiveUserId,
                kind: "negative_candidate",
                prompt: data.negative.image_prompt,
                candidate_index: index,
              },
              getAuthHeader
            );
            if (!result.imageUrl) {
              const message = result.message || "画像を生成できませんでした";
              if (!cancelled) {
                setCandidateErrors((prev) => {
                  const next = [...prev];
                  next[index] = message;
                  return next;
                });
              }
              continue;
            }
            if (!cancelled) {
              setCandidateUrls((prev) => {
                const next = [...prev];
                next[index] = result.imageUrl ?? null;
                return next;
              });
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : "画像生成に失敗しました";
            if (!cancelled) {
              setCandidateErrors((prev) => {
                const next = [...prev];
                next[index] = message;
                return next;
              });
            }
          } finally {
            if (!cancelled) {
              setCandidateBusy((prev) => {
                const next = [...prev];
                next[index] = false;
                return next;
              });
            }
            await wait(800);
          }
        }
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
      if (candidateLoading) {
        await wait(1200);
      }
      try {
        const result = await fetchImageWithRetry(
          {
            card_id: data.card_id,
            user_id: effectiveUserId,
            kind: "positive",
            prompt: data.positive.image_prompt,
          },
          getAuthHeader
        );
        if (!result.imageUrl) {
          if (!cancelled) {
            setActionImageError(result.message || "画像を生成できませんでした");
          }
          return;
        }
        if (!cancelled) {
          setActionImageUrl(result.imageUrl ?? null);
        }
      } catch {
        if (!cancelled) {
          setActionImageUrl(null);
          setActionImageError("画像を生成できませんでした");
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
      const authHeader = await getAuthHeader();
      await fetch("/api/select-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader ?? {}) },
        body: JSON.stringify({ card_id: data.card_id, user_id: effectiveUserId, image_url: url }),
      });
    } catch {
      // no-op
    }
  };

  const retryCandidate = async (index: number) => {
    if (!data || !effectiveUserId) return;
    setCandidateErrors((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setCandidateBusy((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
    try {
      const result = await fetchImageWithRetry(
        {
          card_id: data.card_id,
          user_id: effectiveUserId,
          kind: "negative_candidate",
          prompt: data.negative.image_prompt,
          candidate_index: index,
        },
        getAuthHeader
      );
      if (!result.imageUrl) {
        setCandidateErrors((prev) => {
          const next = [...prev];
          next[index] = result.message || "画像を生成できませんでした";
          return next;
        });
        return;
      }
      setCandidateUrls((prev) => {
        const next = [...prev];
        next[index] = result.imageUrl ?? null;
        return next;
      });
    } finally {
      setCandidateBusy((prev) => {
        const next = [...prev];
        next[index] = false;
        return next;
      });
    }
  };

  const onRegister = async () => {
    if (!data) return;
    if (!userId) {
      setError("ログインが必要です");
      return;
    }
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
      const authHeader = await getAuthHeader();
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader ?? {}) },
        body: JSON.stringify({
          card_id: data.card_id,
          user_id: userId,
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
      router.push("/calendar");
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
                  const selected = Boolean(url && selectedUrl === url);
                  const handleCandidateKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
                    if (!url) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectCandidate(url);
                    }
                  };

                  return (
                    <div
                      key={`${url ?? "candidate"}-${index}`}
                      role="button"
                      tabIndex={url ? 0 : -1}
                      aria-pressed={selected ? "true" : "false"}
                      onClick={() => {
                        if (url) {
                          void onSelectCandidate(url);
                        }
                      }}
                      onKeyDown={handleCandidateKey}
                      className={`mural-frame relative overflow-hidden rounded-2xl transition ${
                        selected ? "ring-4 ring-emerald-300" : "ring-1 ring-transparent"
                      } ${url ? "cursor-pointer" : "cursor-default"}`}
                      style={{ aspectRatio: "9 / 16" }}
                    >
                      {url ? (
                        <img src={url} alt={`候補${index + 1}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-xs text-slate-400">
                          <span>
                            {candidateErrors[index]
                              ? candidateErrors[index]
                              : candidateBusy[index]
                                ? "生成中..."
                                : candidateLoading
                                  ? "生成待機中..."
                                  : "画像を生成できませんでした"}
                          </span>
                          {!candidateBusy[index] && candidateErrors[index] && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                retryCandidate(index);
                              }}
                              className="rounded-full border border-slate-500 px-3 py-1 text-[11px] text-slate-200"
                            >
                              再生成
                            </button>
                          )}
                        </div>
                      )}
                      {selected && <div className="absolute inset-0 border-2 border-emerald-200" />}
                    </div>
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
                        {actionImageLoading
                          ? "生成中..."
                          : actionImageError || "画像を生成できませんでした"}
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
                    {userId ? (
                      <button
                        className="rounded-md bg-emerald-300 px-4 py-2 text-emerald-950 disabled:opacity-50"
                        onClick={onRegister}
                        disabled={registering}
                      >
                        {registering ? "登録中..." : "カレンダーに登録"}
                      </button>
                    ) : (
                      <button
                        className="rounded-md border border-slate-600 px-4 py-2 text-slate-200"
                        onClick={onLogin}
                      >
                        Googleでログインしてください
                      </button>
                    )}
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

export default function DrawPage() {
  return (
    <Suspense fallback={<div className="mural-bg min-h-screen text-slate-100" />}>
      <DrawPageContent />
    </Suspense>
  );
}
