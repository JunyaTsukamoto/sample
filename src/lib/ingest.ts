import { prisma } from "./prisma";
import { fetchAllSources } from "./fetchSources";
import { SOURCES } from "./sources";

export interface IngestResult {
  sourceCount: number;
  fetched: number;
  upserted: number;
  sourceErrors: { source: string; error: string }[];
}

export async function runIngestion(): Promise<IngestResult> {
  const { articles, errors } = await fetchAllSources();

  const seen = new Set<string>();
  const deduped = articles.filter((a) => {
    if (!a.guid || seen.has(a.guid)) return false;
    seen.add(a.guid);
    return true;
  });

  let upserted = 0;
  for (const article of deduped) {
    await prisma.article.upsert({
      where: { guid: article.guid },
      create: article,
      update: {
        title: article.title,
        summary: article.summary,
        imageUrl: article.imageUrl,
      },
    });
    upserted++;
  }

  return {
    sourceCount: SOURCES.length,
    fetched: articles.length,
    upserted,
    sourceErrors: errors,
  };
}
