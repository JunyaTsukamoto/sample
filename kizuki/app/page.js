"use client";

import { useEffect, useState, useCallback } from "react";
import ArticleCard from "@/components/ArticleCard.js";
import { CATEGORIES } from "@/lib/categories.js";

const TABS = [{ value: "", label: "すべて" }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.label }))];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(res, fallbackMessage) {
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // raw textはエラーメッセージ用に無視
  }
  if (!res.ok) {
    throw new Error(data?.error || `${fallbackMessage} (HTTP ${res.status})`);
  }
  return data;
}

async function fetchLatestRun() {
  const res = await fetch("/api/status", { cache: "no-store" });
  if (!res.ok) throw new Error("バッチ状況の取得に失敗しました");
  const data = await res.json();
  return { run: data.runs?.[0] ?? null, status: data };
}

async function waitForBatchCompletion({ previousRunId, targetRunId }) {
  let currentTargetRunId = targetRunId;
  for (let attempt = 0; attempt < 36; attempt += 1) {
    await sleep(5000);
    try {
      const { run: latest } = await fetchLatestRun();
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
      // ポーリングの一時的な失敗ではバックグラウンド処理を止めない
    }
  }
  return null;
}

export default function HomePage() {
  const [category, setCategory] = useState("");
  const [articles, setArticles] = useState([]);
  const [status, setStatus] = useState(null);
  const [mutationTriggered, setMutationTriggered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [message, setMessage] = useState("");

  const fetchArticles = useCallback(async ({ signal } = {}) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    params.set("limit", "200");
    const res = await fetch(`/api/articles?${params.toString()}`, { signal });
    if (!res.ok) throw new Error("記事一覧の取得に失敗しました");
    return res.json();
  }, [category]);

  const refreshStatus = useCallback(async () => {
    const res = await fetch("/api/status", { cache: "no-store" });
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    Promise.all([fetchArticles({ signal: controller.signal }), refreshStatus()])
      .then(([data]) => {
        if (controller.signal.aborted) return;
        setArticles(data.articles || []);
        setMutationTriggered(!!data.mutationTriggered);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setMessage(`エラー: ${err.message}`);
        setLoading(false);
      });
    return () => controller.abort();
  }, [fetchArticles, refreshStatus]);

  async function handleCollect() {
    setCollecting(true);
    setMessage("収集・要約を開始しています...");
    try {
      const { run: latestBefore } = await fetchLatestRun().catch(() => ({ run: null }));
      const previousRunId = latestBefore?.id ?? 0;
      const targetRunId = latestBefore?.status === "running" ? latestBefore.id : null;
      const res = await fetch("/api/refresh?background=1", { method: "POST" });
      const data = await readJson(res, "収集APIの開始に失敗しました");
      if (!data?.ok) throw new Error(data?.error || "収集APIの開始に失敗しました");

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
      const [feedData] = await Promise.all([fetchArticles(), refreshStatus()]);
      setArticles(feedData.articles || []);
      setMutationTriggered(!!feedData.mutationTriggered);
      setLoading(false);

      if (run) {
        setMessage(
          `完了: 新着 ${run.new_count}件 / 要約 ${run.summarized_count}件` +
            (run.failed_count ? ` / 失敗 ${run.failed_count}件` : "")
        );
      } else {
        setMessage("収集・要約を開始しました。少し待ってから再読み込みしてください。");
      }
    } catch (err) {
      setMessage(`エラー: ${err.message}`);
      setLoading(false);
    } finally {
      setCollecting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          最終更新: {status?.lastUpdatedAt ? new Date(status.lastUpdatedAt).toLocaleString("ja-JP") : "未実行"}
          ・{status?.activeCount ?? 0}件の兆し
        </p>
        <button
          onClick={handleCollect}
          disabled={collecting}
          className="text-sm px-3 py-1.5 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-50"
        >
          {collecting ? "実行中..." : "今すぐ収集・要約"}
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setLoading(true);
              setCategory(t.value);
            }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm ${
              category === t.value
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && <p className="text-xs text-slate-500 dark:text-slate-400">{message}</p>}
      {mutationTriggered && (
        <p className="text-xs text-violet-500">
          🌱 今回は多様性確保のため、普段は表示されにくい記事を1件混ぜています
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">読み込み中...</p>
      ) : articles.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 text-center">
          記事がありません。「今すぐ収集・要約」を実行するか、情報源管理画面でソースを確認してください。
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
