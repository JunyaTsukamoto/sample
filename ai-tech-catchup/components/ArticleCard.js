import Link from "next/link";
import { categoryLabel } from "@/lib/categories.js";

function formatDate(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ArticleCard({ article }) {
  const isPractice = article.trackType === "practice";

  return (
    <Link
      href={`/articles/${article.id}`}
      className="block bg-white border border-slate-200 rounded-lg p-4 hover:shadow-sm hover:border-slate-300 transition"
    >
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            isPractice
              ? "bg-emerald-100 text-emerald-700"
              : "bg-sky-100 text-sky-700"
          }`}
        >
          {isPractice ? "実践系" : "動向系"}
        </span>
        {article.categories.map((c) => (
          <span
            key={c}
            className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
          >
            {categoryLabel(c)}
          </span>
        ))}
        {article.crossDomainTags.includes("disaster_abm_gis") && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            防災・ABM・GIS
          </span>
        )}
        {isPractice && typeof article.practicalityScore === "number" && (
          <span className="text-xs text-amber-500" title="実践可能性スコア">
            {"★".repeat(Math.max(0, Math.min(5, article.practicalityScore)))}
            {"☆".repeat(5 - Math.max(0, Math.min(5, article.practicalityScore)))}
          </span>
        )}
      </div>

      <h3 className="font-medium text-slate-900 leading-snug">{article.title}</h3>

      {article.summary && (
        <p className="mt-1.5 text-sm text-slate-600 line-clamp-3">
          {article.summary}
        </p>
      )}

      <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
        <span>{article.sourceName || "不明なソース"}</span>
        <span>{formatDate(article.publishedAt || article.fetchedAt)}</span>
        {article.llmProcessStatus !== "done" && (
          <span className="text-rose-400">
            {article.llmProcessStatus === "pending" ? "未処理" : "要約失敗"}
          </span>
        )}
      </div>
    </Link>
  );
}
