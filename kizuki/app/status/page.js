"use client";

import { useCallback, useEffect, useState } from "react";

function formatDateTime(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ja-JP");
  } catch {
    return iso;
  }
}

const STATUS_LABEL = { running: "実行中", success: "成功", failed: "失敗" };

export default function StatusPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStatus = useCallback(async ({ signal } = {}) => {
    const res = await fetch("/api/status", { signal });
    if (!res.ok) throw new Error("バッチ状況の取得に失敗しました");
    return res.json();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchStatus({ signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [fetchStatus]);

  if (error) return <p className="text-sm text-rose-500">{error}</p>;
  if (loading || !data) return <p className="text-sm text-slate-400">読み込み中...</p>;

  const counts = Object.fromEntries(data.statusCounts.map((c) => [c.status, c.c]));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold mb-1">バッチ実行状況</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          直近のバッチ実行結果と記事の処理状況を確認できます。
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-surface/70 dark:bg-surface/30 border border-black/5 dark:border-white/10 rounded-2xl p-3 text-center">
          <p className="text-xs text-slate-400">総記事数</p>
          <p className="text-xl font-semibold">{data.totalArticles}</p>
        </div>
        <div className="bg-surface/70 dark:bg-surface/30 border border-black/5 dark:border-white/10 rounded-2xl p-3 text-center">
          <p className="text-xs text-slate-400">要約済み</p>
          <p className="text-xl font-semibold text-emerald-600">{counts.done || 0}</p>
        </div>
        <div className="bg-surface/70 dark:bg-surface/30 border border-black/5 dark:border-white/10 rounded-2xl p-3 text-center">
          <p className="text-xs text-slate-400">未処理</p>
          <p className="text-xl font-semibold text-slate-500">{counts.pending || 0}</p>
        </div>
        <div className="bg-surface/70 dark:bg-surface/30 border border-black/5 dark:border-white/10 rounded-2xl p-3 text-center">
          <p className="text-xs text-slate-400">要約失敗</p>
          <p className="text-xl font-semibold text-rose-500">{counts.failed || 0}</p>
        </div>
      </div>

      <div className="bg-surface/70 dark:bg-surface/30 border border-black/5 dark:border-white/10 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
        <h2 className="p-3 text-sm font-semibold text-slate-700 dark:text-slate-300">実行履歴</h2>
        {data.runs.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">まだ実行履歴がありません</p>
        ) : (
          data.runs.map((r) => (
            <div key={r.id} className="p-3 text-sm flex items-center justify-between gap-3">
              <div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full mr-2 ${
                    r.status === "success"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                      : r.status === "failed"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {STATUS_LABEL[r.status] || r.status}
                </span>
                {formatDateTime(r.started_at)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
                取得 {r.fetched_count} / 新着 {r.new_count} / 要約 {r.summarized_count} / 失敗{" "}
                {r.failed_count}
                {r.error_message && (
                  <p className="text-rose-400 truncate max-w-xs">{r.error_message}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
