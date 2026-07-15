import type { Category } from "@/generated/prisma/client";

export type SourceType = "rss" | "arxiv";

export interface SourceConfig {
  id: string;
  name: string;
  url: string;
  category: Category;
  type: SourceType;
  tags?: string[];
}

export interface NormalizedArticle {
  guid: string;
  url: string;
  title: string;
  summary: string;
  category: Category;
  sourceName: string;
  sourceUrl: string;
  tags: string[];
  imageUrl: string | null;
  publishedAt: Date;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  AI_TECH: "AI・技術動向",
  GOV_POLICY: "政策・行政",
  SOCIAL_DATA_METHOD: "社会課題・DS手法",
  ACADEMIC_RESEARCH: "学術・研究",
  CORPORATE_BUSINESS: "新規事業",
};
