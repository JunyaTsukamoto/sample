"use client";

import { useCallback, useEffect, useState } from "react";

const emptyForm = { name: "", url: "", trackType: "trend", fetchMethod: "rss" };

export default function SourcesPage() {
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSources = useCallback(async ({ signal } = {}) => {
    const res = await fetch("/api/sources", { signal });
    if (!res.ok) {
      throw new Error("情報源一覧の取得に失敗しました");
    }
    const data = await res.json();
    if (signal?.aborted) return;
    return data.sources || [];
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSources({ signal: controller.signal })
      .then((nextSources) => {
        if (controller.signal.aborted) return;
        setSources(nextSources);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [fetchSources]);

  async function reloadSources() {
    const nextSources = await fetchSources();
    setSources(nextSources);
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
        <p className="text-sm text-slate-500">
          RSS/APIの情報源を追加・削除・有効/無効切り替えできます。動向系/実践系の区分は収集・要約時のプロンプト選択に使われます。
        </p>
      </div>

      <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">新規追加</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            className="border border-slate-200 rounded-md px-3 py-1.5 text-sm col-span-2"
            placeholder="ソース名（例: Qiita AIタグ）"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="border border-slate-200 rounded-md px-3 py-1.5 text-sm col-span-2"
            placeholder="RSS/APIのURL"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            required
          />
          <select
            className="border border-slate-200 rounded-md px-3 py-1.5 text-sm"
            value={form.trackType}
            onChange={(e) => setForm({ ...form, trackType: e.target.value })}
          >
            <option value="trend">動向系</option>
            <option value="practice">実践系</option>
          </select>
          <select
            className="border border-slate-200 rounded-md px-3 py-1.5 text-sm"
            value={form.fetchMethod}
            onChange={(e) => setForm({ ...form, fetchMethod: e.target.value })}
          >
            <option value="rss">RSS</option>
            <option value="api">API（今後拡張予定）</option>
          </select>
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <button className="text-sm px-4 py-1.5 rounded-md bg-slate-900 text-white">
          追加
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">読み込み中...</p>
        ) : sources.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">情報源がありません</p>
        ) : (
          sources.map((s) => (
            <div key={s.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.trackType === "practice"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    {s.trackType === "practice" ? "実践系" : "動向系"}
                  </span>
                  <span className="font-medium text-slate-800 truncate">{s.name}</span>
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
                      ? "border-emerald-200 text-emerald-700 bg-emerald-50"
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
