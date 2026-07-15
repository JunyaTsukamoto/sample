"use client";

import { useEffect, useState } from "react";
import ArticleCard from "@/components/ArticleCard.js";

export default function BookmarksPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/bookmarks", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (controller.signal.aborted) return;
        setArticles(data.articles || []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">🔖 ブックマーク</h1>
      {loading ? (
        <p className="text-sm text-slate-400">読み込み中...</p>
      ) : articles.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 bg-surface/70 dark:bg-surface/30 border border-black/5 dark:border-white/10 rounded-2xl p-6 text-center">
          ブックマークした記事はまだありません。
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}
