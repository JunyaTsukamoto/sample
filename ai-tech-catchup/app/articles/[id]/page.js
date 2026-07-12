"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { categoryLabel } from "@/lib/categories.js";

function formatDateTime(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ja-JP");
  } catch {
    return iso;
  }
}

export default function ArticleDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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

  const isPractice = article.trackType === "practice";

  return (
    <article className="bg-white border border-slate-200 rounded-lg p-6 max-w-3xl">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← 一覧へ戻る
      </Link>

      <div className="flex items-center gap-2 flex-wrap mt-4 mb-2">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            isPractice ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"
          }`}
        >
          {isPractice ? "実践系" : "動向系"}
        </span>
        {article.categories.map((c) => (
          <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {categoryLabel(c)}
          </span>
        ))}
        {article.crossDomainTags.includes("disaster_abm_gis") && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            防災・ABM・GIS
          </span>
        )}
      </div>

      <h1 className="text-xl font-semibold text-slate-900 leading-snug">{article.title}</h1>

      <div className="mt-1 text-xs text-slate-400 flex gap-3">
        <span>{article.sourceName || "不明なソース"}</span>
        <span>公開: {formatDateTime(article.publishedAt)}</span>
        <span>収集: {formatDateTime(article.fetchedAt)}</span>
      </div>

      {isPractice && typeof article.practicalityScore === "number" && (
        <div className="mt-3 text-sm text-amber-600">
          実践可能性スコア:{" "}
          {"★".repeat(Math.max(0, Math.min(5, article.practicalityScore)))}
          {"☆".repeat(5 - Math.max(0, Math.min(5, article.practicalityScore)))}
          {" "}({article.practicalityScore}/5)
        </div>
      )}

      <section className="mt-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">要約</h2>
        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
          {article.summary || "(未処理)"}
        </p>
      </section>

      {article.howToPoints?.length > 0 && (
        <section className="mt-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">手順・ポイント</h2>
          <ul className="list-disc list-inside text-sm text-slate-700 space-y-0.5">
            {article.howToPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      {article.tags?.length > 0 && (
        <section className="mt-4 flex gap-1.5 flex-wrap">
          {article.tags.map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500">
              #{t}
            </span>
          ))}
        </section>
      )}

      <div className="mt-6 pt-4 border-t border-slate-100">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm px-4 py-2 rounded-md bg-slate-900 text-white"
        >
          元記事を開く ↗
        </a>
      </div>
    </article>
  );
}
