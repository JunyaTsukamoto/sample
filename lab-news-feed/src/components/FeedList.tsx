"use client";

import { useState } from "react";
import type { Category } from "@/generated/prisma/client";
import { useFeed } from "@/hooks/useFeed";
import { ArticleCard } from "./ArticleCard";
import { CategoryChips } from "./CategoryChips";
import { RefreshButton } from "./RefreshButton";

export function FeedList() {
  const [category, setCategory] = useState<Category | undefined>(undefined);
  const { items, loading, error, hasMore, loadMore, dismiss, refresh } = useFeed(category);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Lab News Feed</h1>
        <RefreshButton onRefreshed={refresh} />
      </div>

      <CategoryChips selected={category} onSelect={setCategory} />

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950 dark:text-rose-300">
          読み込みに失敗しました: {error}
        </p>
      )}

      {!loading && items.length === 0 && !error && (
        <p className="rounded-lg bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          まだ記事がありません。「今すぐ更新」を押すか、朝7時の自動更新をお待ちください。
        </p>
      )}

      <div className="flex flex-col gap-3">
        {items.map((article) => (
          <ArticleCard key={article.id} article={article} onDismiss={dismiss} />
        ))}
      </div>

      {hasMore && !error && items.length > 0 && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mx-auto rounded-full bg-zinc-100 px-4 py-1.5 text-sm text-zinc-600 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {loading ? "読み込み中…" : "もっと見る"}
        </button>
      )}
    </div>
  );
}
