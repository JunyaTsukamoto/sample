"use client";

import { useEffect, useState, useCallback } from "react";
import ArticleCard from "@/components/ArticleCard.js";
import { CATEGORIES, CROSS_DOMAIN_TAG } from "@/lib/categories.js";

const TRACK_TABS = [
  { value: "", label: "すべて" },
  { value: "trend", label: "動向系" },
  { value: "practice", label: "実践系" },
];

export default function HomePage() {
  const [track, setTrack] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [crossDomainOnly, setCrossDomainOnly] = useState(false);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (track) params.set("track", track);
    if (crossDomainOnly) params.set("crossDomain", "1");
    // カテゴリは複数選択可なので、選択中の最初の1件をサーバー側条件に、
    // 残りはクライアント側で絞り込む（DBがJSON配列のためLIKE検索の簡易実装）
    if (selectedCategories.length > 0) {
      params.set("category", selectedCategories[0]);
    }
    params.set("limit", "200");

    const res = await fetch(`/api/articles?${params.toString()}`);
    const data = await res.json();
    let list = data.articles || [];
    if (selectedCategories.length > 1) {
      list = list.filter((a) =>
        selectedCategories.every((c) => a.categories.includes(c))
      );
    }
    setArticles(list);
    setLoading(false);
  }, [track, selectedCategories, crossDomainOnly]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleCategory(id) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleCollect() {
    setCollecting(true);
    setMessage("収集・要約を実行中...");
    try {
      const res = await fetch("/api/collect", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setMessage(
          `完了: 新着 ${data.collectResult.inserted}件 / 要約 ${data.summarizeResult.done}件` +
            (data.summarizeResult.usingFallback
              ? "（ANTHROPIC_API_KEY未設定のため簡易要約）"
              : "")
        );
        await load();
      } else {
        setMessage(`エラー: ${data.error}`);
      }
    } catch (err) {
      setMessage(`エラー: ${err.message}`);
    } finally {
      setCollecting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
      <aside className="space-y-6">
        <div>
          <h2 className="text-xs font-semibold text-slate-500 mb-2">系統</h2>
          <div className="flex md:flex-col gap-1">
            {TRACK_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTrack(t.value)}
                className={`text-left px-3 py-1.5 rounded-md text-sm ${
                  track === t.value
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-slate-500 mb-2">カテゴリ</h2>
          <div className="space-y-1">
            {CATEGORIES.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(c.id)}
                  onChange={() => toggleCategory(c.id)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-slate-500 mb-2">横断タグ</h2>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={crossDomainOnly}
              onChange={(e) => setCrossDomainOnly(e.target.checked)}
            />
            {CROSS_DOMAIN_TAG.label}のみ
          </label>
        </div>

        <button
          onClick={handleCollect}
          disabled={collecting}
          className="w-full text-sm px-3 py-2 rounded-md bg-slate-900 text-white disabled:opacity-50"
        >
          {collecting ? "実行中..." : "今すぐ収集・要約"}
        </button>
        {message && <p className="text-xs text-slate-500">{message}</p>}
      </aside>

      <section>
        {loading ? (
          <p className="text-sm text-slate-400">読み込み中...</p>
        ) : articles.length === 0 ? (
          <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded-lg p-6 text-center">
            記事がありません。「今すぐ収集・要約」を実行するか、情報源管理画面でソースを確認してください。
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
