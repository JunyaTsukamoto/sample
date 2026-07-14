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
    <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
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
              className="text-xs px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300"
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

        <h3 className="font-medium text-slate-900 dark:text-slate-100 leading-snug">
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
          className={`text-sm px-2.5 py-1 rounded-md border ${
            feedback === 1
              ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900 dark:border-emerald-700"
              : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          👍 もっと見たい
        </button>
        <button
          onClick={() => sendFeedback(-1)}
          className={`text-sm px-2.5 py-1 rounded-md border ${
            feedback === -1
              ? "border-slate-400 bg-slate-100 dark:bg-slate-800 dark:border-slate-600"
              : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          👎 あまり興味ない
        </button>
      </div>
    </div>
  );
}
