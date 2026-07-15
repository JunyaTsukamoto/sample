"use client";

import { useState } from "react";
import Link from "next/link";
import { categoryLabel } from "@/lib/categories.js";
import { relativeDate } from "@/lib/format.js";

export default function ArticleCard({ article }) {
  const [feedback, setFeedback] = useState(null); // 1 | -1 | null (楽観的UI用)
  const [bookmarked, setBookmarked] = useState(article.isBookmarked);
  const [sending, setSending] = useState(false);

  async function sendFeedback(value) {
    if (sending) return;
    setSending(true);
    const next = feedback === value ? null : value;
    setFeedback(next);
    try {
      await fetch(`/api/articles/${article.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next ?? value }),
      });
    } finally {
      setSending(false);
    }
  }

  async function toggleBookmark(e) {
    e.preventDefault();
    e.stopPropagation();
    const next = !bookmarked;
    setBookmarked(next);
    await fetch(`/api/articles/${article.id}/bookmark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookmarked: next }),
    });
  }

  return (
    <div className="relative bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl p-4 hover:shadow-md transition backdrop-blur">
      <button
        onClick={toggleBookmark}
        aria-label="ブックマーク"
        className="absolute top-3 right-3 text-lg"
      >
        {bookmarked ? "🔖" : "📑"}
      </button>

      <Link href={`/articles/${article.id}`} className="block pr-8">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {article.categories.map((c) => (
            <span
              key={c}
              className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium"
            >
              {categoryLabel(c)}
            </span>
          ))}
          {article.isSerendipity && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">
              🌱 掘り出し物
            </span>
          )}
          {article.trendScore > 0.6 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">
              🔥 兆し
            </span>
          )}
        </div>

        <h3 className="font-heading font-medium text-foreground leading-snug">
          {article.title}
        </h3>

        {article.summary && (
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
            {article.summary}
          </p>
        )}

        {article.tags?.length > 0 && (
          <div className="mt-1.5 flex gap-1.5 flex-wrap">
            {article.tags.map((t) => (
              <span key={t} className="text-xs text-slate-400 dark:text-slate-500">
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          <span>{article.sourceName || "不明なソース"}</span>
          <span>{relativeDate(article.publishedAt || article.fetchedAt)}</span>
          {article.llmProcessStatus !== "done" && (
            <span className="text-rose-400">
              {article.llmProcessStatus === "pending" ? "未処理" : "要約失敗"}
            </span>
          )}
        </div>
      </Link>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => sendFeedback(1)}
          className={`text-sm px-2.5 py-1 rounded-full border ${
            feedback === 1
              ? "border-accent bg-accent/15 text-accent"
              : "border-black/10 dark:border-white/15 opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          👍 もっと見たい
        </button>
        <button
          onClick={() => sendFeedback(-1)}
          className={`text-sm px-2.5 py-1 rounded-full border ${
            feedback === -1
              ? "border-black/30 dark:border-white/40 bg-black/5 dark:bg-white/10"
              : "border-black/10 dark:border-white/15 opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          👎 あまり興味ない
        </button>
      </div>
    </div>
  );
}
