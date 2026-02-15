"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getFirebaseAuth, getGoogleProvider, hasFirebaseConfig, ensureAnonymousUser } from "@/lib/firebaseClient";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";

type GalleryItem = {
  card_id: string;
  negative_image_url?: string | null;
  positive_image_url?: string | null;
  created_at?: string | null;
};

export default function Home() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [selfImageUrl, setSelfImageUrl] = useState<string | null>(null);
  const [selfImageDescription, setSelfImageDescription] = useState<string | null>(null);
  const [selfImageLoading, setSelfImageLoading] = useState(false);
  const [selfImageError, setSelfImageError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const negativeGalleryRef = useRef<HTMLDivElement | null>(null);
  const positiveGalleryRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      return;
    }
    void ensureAnonymousUser(auth);
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserId(null);
        setIdToken(null);
        setAuthUser(null);
        return;
      }
      const token = await user.getIdToken();
      setUserId(user.uid);
      setIdToken(token);
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
      const message = err instanceof Error ? err.message : "ログインに失敗しました";
      if (message.includes("auth/popup-closed-by-user")) {
        return;
      }
      setAuthError(message);
    }
  };

  const onLogout = async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signOut(auth);
  };

  const authHeader: HeadersInit | undefined = useMemo(
    () => (idToken ? { Authorization: `Bearer ${idToken}` } : undefined),
    [idToken]
  );

  const galleryVisibleItems = useMemo(() => {
    const isValidImage = (url?: string | null) => {
      if (!url) return false;
      const trimmed = url.trim();
      if (!trimmed) return false;
      return trimmed !== "/calendar-default.svg" && trimmed !== "/file.svg";
    };
    return galleryItems.filter(
      (item) => isValidImage(item.negative_image_url) && isValidImage(item.positive_image_url)
    );
  }, [galleryItems]);

  const loadGallery = async (targetUserId: string | null) => {
    setGalleryError(null);
    setGalleryLoading(true);
    try {
      const endpoint =
        idToken && targetUserId && authUser && !authUser.isAnonymous
          ? `/api/history?user_id=${encodeURIComponent(targetUserId)}`
          : "/api/history?public=1";
      const res = await fetch(endpoint, {
        headers: authHeader,
      });
      const json = (await res.json()) as { items?: GalleryItem[]; message?: string };
      if (!res.ok || !json.items) {
        throw new Error(json.message || "図鑑の取得に失敗しました");
      }
      setGalleryItems(json.items);
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : "図鑑の取得に失敗しました");
    } finally {
      setGalleryLoading(false);
    }
  };

  useEffect(() => {
    if (!idToken) {
      loadGallery(null);
      return;
    }
    loadGallery(userId);
  }, [userId, idToken]);

  const canUsePersonalFeatures = Boolean(authUser && !authUser.isAnonymous && userId && idToken);

  useEffect(() => {
    if (!canUsePersonalFeatures || !userId) return;
    const loadSelfImage = async () => {
      try {
        const res = await fetch(`/api/self-image?user_id=${encodeURIComponent(userId)}`, {
          headers: authHeader,
        });
        const json = (await res.json()) as { image_url?: string | null; description?: string | null };
        if (!res.ok) return;
        setSelfImageUrl(json.image_url ?? null);
        setSelfImageDescription(json.description ?? null);
      } catch {
        // no-op
      }
    };
    loadSelfImage();
  }, [canUsePersonalFeatures, userId, authHeader]);

  const scrollGallery = (ref: { current: HTMLDivElement | null }, direction: number) => {
    const el = ref.current;
    if (!el) return;
    const cardWidth = el.firstElementChild instanceof HTMLElement ? el.firstElementChild.offsetWidth : 220;
    const gap = 16;
    const delta = (cardWidth + gap) * direction;
    const nextLeft = el.scrollLeft + delta;
    el.scrollLeft = nextLeft;
    requestAnimationFrame(() => {
      el.scrollTo({ left: nextLeft, behavior: "smooth" });
    });
  };

  const onGenerate = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("不安を入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!effectiveUserId) {
        const auth = getFirebaseAuth();
        const result = await ensureAnonymousUser(auth);
        let tries = 0;
        while (!auth?.currentUser && tries < 10) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          tries += 1;
        }
        if (!auth?.currentUser) {
          if (result?.errorCode === "auth/operation-not-allowed") {
            setError("匿名ログインが無効です。Firebaseコンソールで匿名認証を有効にしてください。");
          } else {
            setError("ユーザー情報の準備中です。少し待ってから再試行してください。");
          }
          return;
        }
      }
      router.push(`/draw?text=${encodeURIComponent(trimmed)}`);
    } finally {
      setLoading(false);
    }
  };

  const onGenerateSelfImage = async () => {
    if (!userId) {
      setSelfImageError("ログインが必要です");
      return;
    }
    setSelfImageError(null);
    setSelfImageLoading(true);
    try {
      const res = await fetch("/api/self-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader ?? {}) },
        body: JSON.stringify({ user_id: userId }),
      });
      const json = (await res.json()) as { image_url?: string; description?: string; message?: string };
      if (!res.ok || !json.image_url) {
        throw new Error(json.message || "画像生成に失敗しました");
      }
      setSelfImageUrl(json.image_url);
      setSelfImageDescription(json.description ?? null);
    } catch (err) {
      setSelfImageError(err instanceof Error ? err.message : "画像生成に失敗しました");
    } finally {
      setSelfImageLoading(false);
    }
  };

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
                  className="rounded-full border border-emerald-300 bg-emerald-300 px-3 py-1 text-emerald-950"
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
          <div className="mural-card rounded-2xl p-6" style={{ overflow: "visible" }}>
            <div className="mb-2 text-sm tracking-[0.2em] text-slate-400">今の不安をひとつだけ書いてください</div>
            <textarea
              className="w-full rounded-lg border border-slate-700 bg-slate-950/70 p-4 text-slate-100 placeholder:text-slate-500"
              rows={6}
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
              {error && <span className="text-rose-400">{error}</span>}
            </div>
          </div>

          <div className="mural-card rounded-2xl p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm tracking-[0.2em] text-slate-400">
                {canUsePersonalFeatures ? "あなたが最近生み出したイメージカード" : "イメージカード（例）"}
              </div>
              {canUsePersonalFeatures && (
                <Link
                  href="/gallery"
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200"
                >
                  もっと見る
                </Link>
              )}
            </div>
            {galleryLoading && <div className="text-sm text-slate-400">読み込み中...</div>}
            {galleryError && <div className="text-sm text-rose-400">{galleryError}</div>}
            {!galleryLoading && !galleryError && galleryVisibleItems.length === 0 && (
              <div className="text-sm text-slate-500">まだカードがありません</div>
            )}
            {!galleryLoading && !galleryError && galleryVisibleItems.length > 0 && (
              <div className="grid gap-6">
                <div>
                  <div className="mb-3 text-xs tracking-[0.25em] text-slate-400">不安カード</div>
                  <div className="flex items-center gap-3 overflow-hidden">
                    {galleryVisibleItems.slice(0, 12).map((item) => (
                      <div
                        key={`preview-neg-${item.card_id}`}
                        className="relative h-36 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60"
                        title={item.created_at ?? undefined}
                      >
                        <img
                          src={item.negative_image_url || ""}
                          alt="不安カード"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-3 text-xs tracking-[0.25em] text-slate-400">アクションカード</div>
                  <div className="flex items-center gap-3 overflow-hidden">
                    {galleryVisibleItems.slice(0, 12).map((item) => (
                      <div
                        key={`preview-pos-${item.card_id}`}
                        className="relative h-36 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60"
                        title={item.created_at ?? undefined}
                      >
                        <img
                          src={item.positive_image_url || ""}
                          alt="アクションカード"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mural-card rounded-2xl p-6">
            <div className="mb-2 text-sm tracking-[0.2em] text-slate-400">今のあなたの輪郭</div>
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="mural-frame overflow-hidden rounded-2xl" style={{ aspectRatio: "9 / 16" }}>
                {selfImageUrl ? (
                  <img src={selfImageUrl} alt="今のあなたの輪郭" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                    {selfImageLoading ? "生成中..." : "まだ画像がありません"}
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-200">自分を見つけましょう</div>
                  <p className="mt-2 text-sm text-slate-400">
                    直近の不安カードとアクションカードから、今のあなたの状態を1枚のイメージにします。
                  </p>
                  {selfImageDescription && (
                    <p className="mt-3 text-sm text-slate-200">{selfImageDescription}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {canUsePersonalFeatures ? (
                    <button
                      className="rounded-md bg-emerald-300 px-4 py-2 text-emerald-950 disabled:opacity-50"
                      onClick={onGenerateSelfImage}
                      disabled={selfImageLoading}
                    >
                      {selfImageLoading ? "生成中..." : "自分を見つけましょう"}
                    </button>
                  ) : (
                    <button
                      className="rounded-md border border-slate-600 px-4 py-2 text-slate-200"
                      onClick={onLogin}
                    >
                      Googleでログインしてください
                    </button>
                  )}
                  {selfImageError && <span className="text-sm text-rose-400">{selfImageError}</span>}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
