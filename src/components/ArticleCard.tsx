"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedArticle } from "@/hooks/useFeed";
import { recordInteraction } from "@/hooks/useFeed";
import { CATEGORY_LABELS } from "@/lib/types";

interface ArticleCardProps {
  article: FeedArticle;
  onDismiss: (articleId: string) => void;
}

export function ArticleCard({ article, onDismiss }: ArticleCardProps) {
  const [liked, setLiked] = useState(false);
  const viewedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !viewedRef.current) {
          viewedRef.current = true;
          recordInteraction(article.id, "VIEW");
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [article.id]);

  const handleOpen = () => {
    recordInteraction(article.id, "CLICK");
    window.open(article.url, "_blank", "noopener,noreferrer");
  };

  const handleLike = () => {
    setLiked((v) => !v);
    recordInteraction(article.id, "LIKE");
  };

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900"
    >
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium dark:bg-zinc-800">
          {CATEGORY_LABELS[article.category]}
        </span>
        <span>{article.sourceName}</span>
        <span>·</span>
        <span>{formatRelativeTime(article.publishedAt)}</span>
      </div>

      <button
        type="button"
        onClick={handleOpen}
        className="text-left text-base font-semibold leading-snug text-zinc-900 hover:underline dark:text-zinc-50"
      >
        {article.title}
      </button>

      {article.summary && (
        <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{article.summary}</p>
      )}

      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          onClick={handleLike}
          aria-pressed={liked}
          className={`rounded-full px-3 py-1 text-sm transition-colors ${
            liked
              ? "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          {liked ? "♥ いいね済み" : "♡ いいね"}
        </button>
        <button
          type="button"
          onClick={() => onDismiss(article.id)}
          className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          ✕ 非表示
        </button>
        <button
          type="button"
          onClick={handleOpen}
          className="ml-auto rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          開く ↗
        </button>
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 1) return "たった今";
  if (diffHours < 24) return `${diffHours}時間前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}日前`;
}
