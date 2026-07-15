"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { categoryLabel } from "@/lib/categories.js";
import { relativeDate } from "@/lib/format.js";

export default function ArticleDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/articles/${id}`);
      if (!res.ok) {
        if (!cancelled) setError("記事が見つかりませんでした");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setArticle(data.article);
        setBookmarked(data.article.isBookmarked);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function sendFeedback(value) {
    const next = feedback === value ? null : value;
    setFeedback(next);
    await fetch(`/api/articles/${id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: next ?? value }),
    });
  }

  async function toggleBookmark() {
    const next = !bookmarked;
    setBookmarked(next);
    await fetch(`/api/articles/${id}/bookmark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookmarked: next }),
    });
  }

  if (loading) return <p className="text-sm text-slate-400">読み込み中...</p>;
  if (error || !article)
    return (
      <div>
        <p className="text-sm text-rose-500">{error}</p>
        <button onClick={() => router.back()} className="text-sm text-slate-500 underline">
          戻る
        </button>
      </div>
    );

  return (
    <article className="bg-surface/70 dark:bg-surface/30 border border-black/5 dark:border-white/10 rounded-2xl p-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-slate-500 hover:underline">
          ← 一覧へ戻る
        </Link>
        <button onClick={toggleBookmark} className="text-lg" aria-label="ブックマーク">
          {bookmarked ? "🔖" : "📑"}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-4 mb-2">
        {article.categories.map((c) => (
          <span
            key={c}
            className="text-xs px-2 py-0.5 rounded-full bg-accent-2/50 text-foreground"
          >
            {categoryLabel(c)}
          </span>
        ))}
      </div>

      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 leading-snug">
        {article.title}
      </h1>

      <div className="mt-1 text-xs text-slate-400 flex gap-3">
        <span>{article.sourceName || "不明なソース"}</span>
        <span>公開: {relativeDate(article.publishedAt)}</span>
      </div>

      <section className="mt-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">要約</h2>
        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
          {article.summary || "(未処理)"}
        </p>
      </section>

      {article.tags?.length > 0 && (
        <section className="mt-4 flex gap-1.5 flex-wrap">
          {article.tags.map((t) => (
            <span
              key={t}
              className="text-xs px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
            >
              #{t}
            </span>
          ))}
        </section>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => sendFeedback(1)}
          className={`text-sm px-2.5 py-1 rounded-md border ${
            feedback === 1
              ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900 dark:border-emerald-700"
              : "border-slate-200 dark:border-slate-700"
          }`}
        >
          👍 もっと見たい
        </button>
        <button
          onClick={() => sendFeedback(-1)}
          className={`text-sm px-2.5 py-1 rounded-md border ${
            feedback === -1
              ? "border-slate-400 bg-slate-100 dark:bg-slate-800 dark:border-slate-600"
              : "border-slate-200 dark:border-slate-700"
          }`}
        >
          👎 あまり興味ない
        </button>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm px-4 py-2 rounded-full bg-accent text-accent-foreground"
        >
          元記事を開く
        </a>
      </div>
    </article>
  );
}
