"use client";

import { useEffect, useState, useCallback } from "react";
import ArticleCard from "@/components/ArticleCard.js";
import { CATEGORIES, CROSS_DOMAIN_TAG } from "@/lib/categories.js";

const TRACK_TABS = [
  { value: "", label: "すべて" },
  { value: "trend", label: "動向系" },
  { value: "practice", label: "実践系" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(res, fallbackMessage) {
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // Keep the raw response text for the error below.
  }

  if (!res.ok) {
    throw new Error(data?.error || `${fallbackMessage} (HTTP ${res.status})`);
  }
  return data;
}

async function fetchLatestRun() {
  const res = await fetch("/api/status", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("バッチ状況の取得に失敗しました");
  }
  const data = await res.json();
  return data.runs?.[0] ?? null;
}

async function waitForBatchCompletion({ previousRunId, targetRunId }) {
  let currentTargetRunId = targetRunId;

  for (let attempt = 0; attempt < 36; attempt += 1) {
    await sleep(5000);

    try {
      const latest = await fetchLatestRun();
      if (!latest) continue;

      if (currentTargetRunId && latest.id === currentTargetRunId) {
        if (latest.status !== "running") return latest;
        continue;
      }

      if (!currentTargetRunId && latest.id === previousRunId && latest.status === "running") {
        currentTargetRunId = latest.id;
        continue;
      }

      if (!currentTargetRunId && latest.id > previousRunId) {
        if (latest.status === "running") {
          currentTargetRunId = latest.id;
          continue;
        }
        return latest;
      }
    } catch {
      // Transient polling failures should not cancel the background batch.
    }
  }

  return null;
}

export default function HomePage() {
  const [track, setTrack] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [crossDomainOnly, setCrossDomainOnly] = useState(false);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [message, setMessage] = useState("");

  const fetchArticles = useCallback(async ({ signal } = {}) => {
    const params = new URLSearchParams();
    if (track) params.set("track", track);
    if (crossDomainOnly) params.set("crossDomain", "1");
    // カテゴリは複数選択可なので、選択中の最初の1件をサーバー側条件に、
    // 残りはクライアント側で絞り込む（DBがJSON配列のためLIKE検索の簡易実装）
    if (selectedCategories.length > 0) {
      params.set("category", selectedCategories[0]);
    }
    params.set("limit", "200");

    const res = await fetch(`/api/articles?${params.toString()}`, { signal });
    if (!res.ok) {
      throw new Error("記事一覧の取得に失敗しました");
    }
    const data = await res.json();
    if (signal?.aborted) return;
    let list = data.articles || [];
    if (selectedCategories.length > 1) {
      list = list.filter((a) =>
        selectedCategories.every((c) => a.categories.includes(c))
      );
    }
    return list;
  }, [track, selectedCategories, crossDomainOnly]);

  useEffect(() => {
    const controller = new AbortController();
    fetchArticles({ signal: controller.signal })
      .then((list) => {
        if (controller.signal.aborted) return;
        setArticles(list);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setMessage(`エラー: ${err.message}`);
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [fetchArticles]);

  function toggleCategory(id) {
    setLoading(true);
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleCollect() {
    setCollecting(true);
    setMessage("収集・要約を開始しています...");

    try {
      const latestBefore = await fetchLatestRun().catch(() => null);
      const previousRunId = latestBefore?.id ?? 0;
      const targetRunId = latestBefore?.status === "running" ? latestBefore.id : null;
      const res = await fetch("/api/refresh?background=1", { method: "POST" });
      const data = await readJson(res, "収集APIの開始に失敗しました");
      if (!data?.ok) {
        throw new Error(data?.error || "収集APIの開始に失敗しました");
      }

      setMessage(
        data.running
          ? "収集・要約はすでに実行中です。完了を確認しています..."
          : "収集・要約を開始しました。完了を確認しています..."
      );

      const run = await waitForBatchCompletion({
        previousRunId,
        targetRunId: data.running ? targetRunId : null,
      });
      setLoading(true);
      const list = await fetchArticles();
      setArticles(list);
      setLoading(false);

      if (run) {
        setMessage(
          `完了: 新着 ${run.new_count}件 / 要約 ${run.summarized_count}件` +
            (run.failed_count ? ` / 失敗 ${run.failed_count}件` : "")
        );
      } else {
        setMessage(
          "収集・要約を開始しました。まだ実行中の可能性があります。少し待ってから再読み込みしてください。"
        );
      }
    } catch (err) {
      setMessage(`エラー: ${err.message}`);
      setLoading(false);
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
                onClick={() => {
                  setLoading(true);
                  setTrack(t.value);
                }}
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
              onChange={(e) => {
                setLoading(true);
                setCrossDomainOnly(e.target.checked);
              }}
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
