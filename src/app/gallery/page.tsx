"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { getFirebaseAuth, getGoogleProvider, hasFirebaseConfig } from "@/lib/firebaseClient";

type GalleryItem = {
  card_id: string;
  negative_image_url?: string | null;
  positive_image_url?: string | null;
  created_at?: string | null;
};

export default function GalleryPage() {
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      return;
    }
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

  const canUsePersonalFeatures = Boolean(authUser && !authUser.isAnonymous && userId && idToken);

  const loadGallery = async () => {
    setGalleryError(null);
    setGalleryLoading(true);
    try {
      const endpoint =
        canUsePersonalFeatures && userId
          ? `/api/history?user_id=${encodeURIComponent(userId)}`
          : "/api/history?public=1";
      const res = await fetch(endpoint, { headers: authHeader });
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
    loadGallery();
  }, [canUsePersonalFeatures, userId]);

  const filteredItems = useMemo(
    () =>
      galleryItems.filter((item) => {
        const neg = (item.negative_image_url ?? "").trim();
        const pos = (item.positive_image_url ?? "").trim();
        return neg.length > 0 && pos.length > 0;
      }),
    [galleryItems]
  );

  return (
    <main className="mural-bg min-h-screen text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
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
                  className="rounded-full border border-slate-600 px-3 py-1 text-slate-200"
                >
                  不安から一歩踏み出しましょう
                </Link>
                <Link
                  href="/gallery"
                  className="rounded-full border border-emerald-300 bg-emerald-300 px-3 py-1 text-emerald-950"
                >
                  イメージカード
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              {authUser && !authUser.isAnonymous ? (
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

        <section className="mural-card rounded-2xl p-6">
          <div className="mb-4 text-sm tracking-[0.2em] text-slate-400">
            {canUsePersonalFeatures ? "あなたのイメージカード図鑑" : "イメージカード図鑑（例）"}
          </div>
          {galleryLoading && <div className="text-sm text-slate-400">読み込み中...</div>}
          {galleryError && <div className="text-sm text-rose-400">{galleryError}</div>}
          {!galleryLoading && !galleryError && filteredItems.length === 0 && (
            <div className="text-sm text-slate-500">まだカードがありません</div>
          )}
          {!galleryLoading && !galleryError && filteredItems.length > 0 && (
            <div className="grid gap-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <div className="mb-3 text-xs tracking-[0.25em] text-slate-400">不安カード</div>
                  <div className="grid grid-cols-3 gap-3">
                    {filteredItems.slice(0, 9).map((item) => (
                      <div
                        key={`gallery-neg-${item.card_id}`}
                        className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50"
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
                  <div className="grid grid-cols-3 gap-3">
                    {filteredItems.slice(0, 9).map((item) => (
                      <div
                        key={`gallery-pos-${item.card_id}`}
                        className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50"
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
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
