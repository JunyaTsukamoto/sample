import type { Article, AffinityType, Category } from "@/generated/prisma/client";
import { prisma } from "./prisma";

const RECENCY_HALF_LIFE_HOURS = 36;
const CANDIDATE_WINDOW_DAYS = 14;
const CANDIDATE_POOL_SIZE = 300;

export interface FeedQuery {
  category?: Category;
  cursor?: number;
  limit?: number;
}

export interface RankedArticle extends Article {
  score: number;
}

export interface RankedFeedResult {
  items: RankedArticle[];
  nextCursor: number | null;
}

export async function getRankedFeed({
  category,
  cursor = 0,
  limit = 30,
}: FeedQuery): Promise<RankedFeedResult> {
  const dismissed = await prisma.interaction.findMany({
    where: { type: "DISMISS" },
    select: { articleId: true },
    distinct: ["articleId"],
  });
  const dismissedIds = dismissed.map((d) => d.articleId);

  const candidates = await prisma.article.findMany({
    where: {
      category: category ?? undefined,
      publishedAt: { gte: daysAgo(CANDIDATE_WINDOW_DAYS) },
      id: dismissedIds.length ? { notIn: dismissedIds } : undefined,
    },
    orderBy: { publishedAt: "desc" },
    take: CANDIDATE_POOL_SIZE,
  });

  const affinities = await prisma.affinity.findMany();
  const scoreMap = (type: AffinityType) =>
    new Map(affinities.filter((a) => a.type === type).map((a) => [a.key, a.score]));
  const categoryScore = scoreMap("CATEGORY");
  const sourceScore = scoreMap("SOURCE");
  const tagScore = scoreMap("TAG");

  const scored: RankedArticle[] = candidates.map((article) => {
    const recency = Math.pow(0.5, hoursSince(article.publishedAt) / RECENCY_HALF_LIFE_HOURS);
    const affinity =
      (categoryScore.get(article.category) ?? 0) * 1.0 +
      (sourceScore.get(article.sourceName) ?? 0) * 0.7 +
      article.tags.reduce((sum, tag) => sum + (tagScore.get(tag) ?? 0), 0) * 0.5;

    const score = recency * 10 + affinity * (0.5 + 0.5 * recency);
    return { ...article, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const page = scored.slice(cursor, cursor + limit);
  const nextCursor = cursor + limit < scored.length ? cursor + limit : null;

  return { items: page, nextCursor };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function hoursSince(date: Date): number {
  return (Date.now() - date.getTime()) / (60 * 60 * 1000);
}
