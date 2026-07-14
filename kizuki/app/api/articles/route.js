import { NextResponse } from "next/server";
import { buildFeed } from "@/lib/feed.js";

// 要件 4.3/4.4/4.5: トレンドスコア・好みスコアで重み付けした上で、
// 一定確率で低好みスコアの記事を混入させたフィードを返す。
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || null;
  const limit = Math.min(Number(searchParams.get("limit") || 100), 300);

  const { articles, mutationTriggered, mutationRate } = buildFeed({
    categoryId: category,
    limit,
  });

  return NextResponse.json({
    articles,
    count: articles.length,
    mutationTriggered,
    mutationRate,
  });
}
