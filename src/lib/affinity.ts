import type { Article, InteractionType } from "@/generated/prisma/client";
import { prisma } from "./prisma";

export const INTERACTION_WEIGHTS: Record<InteractionType, number> = {
  VIEW: 0.5,
  CLICK: 1,
  LIKE: 3,
  DISMISS: -3,
};

const LEARNING_RATE = 0.15;
const MIN_SCORE = -5;
const MAX_SCORE = 5;

export async function updateAffinities(article: Article, weight: number) {
  const targets: { type: "CATEGORY" | "SOURCE" | "TAG"; key: string }[] = [
    { type: "CATEGORY", key: article.category },
    { type: "SOURCE", key: article.sourceName },
    ...article.tags.map((tag) => ({ type: "TAG" as const, key: tag })),
  ];

  await Promise.all(targets.map((t) => bumpAffinity(t.type, t.key, weight)));
}

async function bumpAffinity(
  type: "CATEGORY" | "SOURCE" | "TAG",
  key: string,
  weight: number
) {
  const existing = await prisma.affinity.findUnique({
    where: { type_key: { type, key } },
  });

  const next = clamp((existing?.score ?? 0) + LEARNING_RATE * weight, MIN_SCORE, MAX_SCORE);

  await prisma.affinity.upsert({
    where: { type_key: { type, key } },
    create: { type, key, score: next },
    update: { score: next },
  });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
