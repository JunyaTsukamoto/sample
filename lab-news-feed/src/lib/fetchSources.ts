import Parser from "rss-parser";
import { SOURCES } from "./sources";
import type { NormalizedArticle, SourceConfig } from "./types";

const parser = new Parser({ timeout: 15_000 });

export interface FetchSourcesResult {
  articles: NormalizedArticle[];
  errors: { source: string; error: string }[];
}

export async function fetchAllSources(): Promise<FetchSourcesResult> {
  const settled = await Promise.allSettled(SOURCES.map(fetchOneSource));

  const articles: NormalizedArticle[] = [];
  const errors: { source: string; error: string }[] = [];

  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    } else {
      errors.push({ source: SOURCES[i].id, error: String(result.reason) });
    }
  });

  return { articles, errors };
}

async function fetchOneSource(source: SourceConfig): Promise<NormalizedArticle[]> {
  const feed = await parser.parseURL(source.url);
  return (feed.items ?? []).map((item) => normalizeItem(item, source));
}

function normalizeItem(item: Parser.Item, source: SourceConfig): NormalizedArticle {
  const link = item.link?.trim();
  const atomId = (item as unknown as { id?: string }).id;
  const guid = (item.guid || atomId || link || `${source.id}-${item.title}`).trim();

  const title = collapseWhitespace(item.title ?? "(無題)");
  const rawSummary =
    item.contentSnippet ?? item.summary ?? item.content ?? "";
  const summary = collapseWhitespace(stripHtml(rawSummary)).slice(0, 1000);

  const tags = Array.from(
    new Set([...(item.categories ?? []), ...(source.tags ?? [])])
  ).filter(Boolean);

  return {
    guid,
    url: link ?? guid,
    title,
    summary,
    category: source.category,
    sourceName: source.name,
    sourceUrl: source.url,
    tags,
    imageUrl: extractImage(item),
    publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
  };
}

function extractImage(item: Parser.Item): string | null {
  const enclosureUrl = item.enclosure?.url;
  if (enclosureUrl) return enclosureUrl;

  const mediaContent = (item as unknown as { "media:content"?: { $?: { url?: string } } })[
    "media:content"
  ];
  if (mediaContent?.$?.url) return mediaContent.$.url;

  return null;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ");
}

function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}
