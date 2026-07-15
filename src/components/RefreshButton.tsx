"use client";

import { useState } from "react";

interface RefreshButtonProps {
  onRefreshed: () => void | Promise<void>;
}

export function RefreshButton({ onRefreshed }: RefreshButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const data = await res.json();
      if (res.status === 429) {
        setMessage("直前に更新済みです。しばらくしてから再度お試しください。");
      } else if (!res.ok) {
        setMessage("更新に失敗しました。");
      } else {
        setMessage(`更新しました（${data.upserted}件反映）`);
        await onRefreshed();
      }
    } catch {
      setMessage("更新に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {loading ? "更新中…" : "今すぐ更新"}
      </button>
      {message && <span className="text-xs text-zinc-500 dark:text-zinc-400">{message}</span>}
    </div>
  );
}
