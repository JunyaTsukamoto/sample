"use client";

import { useCallback, useEffect, useState } from "react";
import type { Category, InteractionType } from "@/generated/prisma/client";

export interface FeedArticle {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  category: Category;
  sourceName: string;
  tags: string[];
  imageUrl: string | null;
  publishedAt: string;
  score: number;
}

interface FeedResponse {
  items: FeedArticle[];
  nextCursor: number | null;
}

export function useFeed(category: Category | undefined) {
  const [items, setItems] = useState<FeedArticle[]>([]);
  const [cursor, setCursor] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextCursor: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ cursor: String(nextCursor) });
        if (category) params.set("category", category);

        const res = await fetch(`/api/feed?${params.toString()}`);
        if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
        const data: FeedResponse = await res.json();

        setItems((prev) => (nextCursor === 0 ? data.items : [...prev, ...data.items]));
        setCursor(data.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : "unknown error");
      } finally {
        setLoading(false);
      }
    },
    [category]
  );

  useEffect(() => {
    // カテゴリ変更のたびに先頭から取得し直す（外部システム=APIとの同期のためのフェッチ）。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(0);
  }, [load]);

  const loadMore = useCallback(() => {
    if (cursor !== null && !loading) load(cursor);
  }, [cursor, loading, load]);

  const dismiss = useCallback((articleId: string) => {
    setItems((prev) => prev.filter((a) => a.id !== articleId));
    recordInteraction(articleId, "DISMISS");
  }, []);

  const refresh = useCallback(async () => {
    await load(0);
  }, [load]);

  return { items, loading, error, hasMore: cursor !== null, loadMore, dismiss, refresh };
}

export function recordInteraction(articleId: string, type: InteractionType) {
  fetch("/api/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ articleId, type }),
  }).catch(() => {
    // ベストエフォート。失敗しても画面操作は継続する。
  });
}
