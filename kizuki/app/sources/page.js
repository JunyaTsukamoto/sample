"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/categories.js";

const emptyForm = { name: "", url: "", defaultCategory: CATEGORIES[0].id };

export default function SourcesPage() {
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSources = useCallback(async ({ signal } = {}) => {
    const res = await fetch("/api/sources", { signal });
    if (!res.ok) throw new Error("情報源一覧の取得に失敗しました");
    const data = await res.json();
    if (signal?.aborted) return;
    return data.sources || [];
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSources({ signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) return;
        setSources(next);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [fetchSources]);

  async function reloadSources() {
    const next = await fetchSources();
    setSources(next);
    setLoading(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "追加に失敗しました");
      return;
    }
    setForm(emptyForm);
    setLoading(true);
    await reloadSources();
  }

  async function toggleActive(source) {
    setLoading(true);
    await fetch(`/api/sources/${source.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !source.isActive }),
    });
    await reloadSources();
  }

  async function remove(source) {
    if (!confirm(`「${source.name}」を削除しますか？`)) return;
    setLoading(true);
    await fetch(`/api/sources/${source.id}`, { method: "DELETE" });
    await reloadSources();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold mb-1">情報源管理</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          RSS/APIの情報源を追加・削除・有効/無効切り替えできます。デフォルトカテゴリは分類の初期ヒントとして使われます（実際のカテゴリは記事ごとに再判定されます）。
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="bg-surface/70 dark:bg-surface/30 border border-black/5 dark:border-white/10 rounded-2xl p-4 space-y-3"
      >
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">新規追加</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            className="border border-slate-200 dark:border-slate-700 bg-transparent rounded-md px-3 py-1.5 text-sm col-span-2"
            placeholder="ソース名（例: note AIタグ）"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="border border-slate-200 dark:border-slate-700 bg-transparent rounded-md px-3 py-1.5 text-sm col-span-2"
            placeholder="RSS/APIのURL"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            required
          />
          <select
            className="border border-slate-200 dark:border-slate-700 bg-transparent rounded-md px-3 py-1.5 text-sm col-span-2"
            value={form.defaultCategory}
            onChange={(e) => setForm({ ...form, defaultCategory: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <button className="text-sm px-4 py-1.5 rounded-full bg-accent text-accent-foreground">
          追加
        </button>
      </form>

      <div className="bg-surface/70 dark:bg-surface/30 border border-black/5 dark:border-white/10 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">読み込み中...</p>
        ) : sources.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">情報源がありません</p>
        ) : (
          sources.map((s) => (
            <div key={s.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-accent-2/50 text-foreground">
                    {CATEGORIES.find((c) => c.id === s.defaultCategory)?.label || s.defaultCategory}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {s.name}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate">{s.url}</p>
                <p className="text-xs text-slate-400">
                  最終収集: {s.lastFetchedAt ? new Date(s.lastFetchedAt).toLocaleString("ja-JP") : "未収集"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(s)}
                  className={`text-xs px-2 py-1 rounded-md border ${
                    s.isActive
                      ? "border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-900 dark:text-emerald-300"
                      : "border-slate-200 text-slate-400"
                  }`}
                >
                  {s.isActive ? "有効" : "無効"}
                </button>
                <button
                  onClick={() => remove(s)}
                  className="text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-500"
                >
                  削除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
