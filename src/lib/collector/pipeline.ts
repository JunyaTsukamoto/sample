import { Article, Source, CollectionLog } from '../db';
import { fetchFeed } from './fetchFeed';
import { validateArticleUrl } from './validateUrl';
import { summarize, llmEnrich } from './summarize';
import { classifyCategory, extractTags } from './categorize';
import { isDuplicate, registerSeen } from './dedup';
import { normalizeUrl, contentHash, tokenize } from './normalize';
import { toJstIso, nowJstIso, hoursSince } from './time';

export interface PipelineOptions {
  llmKey?: string;
  freshnessHours?: number;   // 既定72h (spec §10)
  maxValidatePerSource?: number;
  maxPerSource?: number;   // 1情報源が1回の収集で公開できる最大件数（多様性確保）
  categoryLimits?: Record<string, { min: number; max: number }>;
  totalMax?: number;
}

const DEFAULT_CATEGORY_LIMITS: Record<string, { min: number; max: number }> = {
  AI: { min: 2, max: 4 },
  制度: { min: 2, max: 4 },
  '社会×データ': { min: 1, max: 3 },
  学術: { min: 1, max: 3 },
  新事業: { min: 2, max: 4 },
};

export interface PipelineResult {
  articles: Article[];
  log: Omit<CollectionLog, 'jobId' | 'scheduledAt' | 'startedAt' | 'finishedAt' | 'status'>;
  updatedSources: Source[];
}

/** trendScore: 新しさ + はてなブックマーク数 */
function trendScore(publishedAt: string, bookmarks?: number): number {
  const ageH = hoursSince(publishedAt);
  const freshness = Math.max(0, 10 - (ageH / 24) * (10 / 7));
  return parseFloat((1 + freshness + (bookmarks ? bookmarks * 0.5 : 0)).toFixed(2));
}

/**
 * 収集パイプライン (spec §5 の20手順)。
 * 有効な情報源 → 取得 → URL正規化/絶対化 → 実HTTP検証 → 本文/公開日抽出 →
 * 整合性/重複/カテゴリ/タグ/要約 → 品質ゲート → 記事生成。
 */
export async function runPipeline(
  sources: Source[],
  existing: Article[],
  opts: PipelineOptions = {}
): Promise<PipelineResult> {
  const freshnessHours = opts.freshnessHours ?? 72;
  const maxValidate = opts.maxValidatePerSource ?? 8;
  const maxPerSource = opts.maxPerSource ?? 3;
  const catLimits = opts.categoryLimits ?? DEFAULT_CATEGORY_LIMITS;
  const totalMax = opts.totalMax ?? 15;

  // 既存記事を「既知」として登録（重複排除 spec §11）
  const seenUrls = new Set<string>();
  const seenHashes = new Set<string>();
  const seenTitleTokens: { tokens: Set<string> }[] = [];
  for (const a of existing) {
    [a.finalUrl, a.url, a.originalUrl].filter(Boolean).forEach((u) => seenUrls.add(normalizeUrl(u as string)));
    if (a.contentHash) seenHashes.add(a.contentHash);
    seenTitleTokens.push({ tokens: tokenize(a.originalTitle || a.title) });
  }

  const catCount: Record<string, number> = {};
  Object.keys(catLimits).forEach((c) => (catCount[c] = 0));

  const out: Article[] = [];
  const errors: { sourceId?: string; message: string }[] = [];
  let candidatesFound = 0, duplicatesRemoved = 0, invalidUrlsRemoved = 0;
  let sourcesSucceeded = 0, sourcesFailed = 0;
  const updatedSources = sources.map((s) => ({ ...s }));

  const enabled = updatedSources.filter((s) => s.enabled && s.type !== 'manual');

  for (const source of enabled) {
    source.lastFetchedAt = nowJstIso();
    let publishedForSource = 0;
    let items;
    try {
      items = await fetchFeed(source);
      sourcesSucceeded++;
      source.lastSuccessAt = nowJstIso();
      source.consecutiveFailures = 0;
    } catch (e: any) {
      sourcesFailed++;
      source.consecutiveFailures = (source.consecutiveFailures || 0) + 1;
      errors.push({ sourceId: source.id, message: `フィード取得失敗: ${e?.message || e}` });
      continue; // 一部失敗しても他は継続 (spec §5 末尾)
    }

    // 新しい順に、上限件数だけ検証
    const sorted = items
      .filter((it) => it.publishedAt) // 公開日の無いものは新着から除外 (spec §10)
      .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());

    let validatedForSource = 0;
    for (const it of sorted) {
      if (validatedForSource >= maxValidate) break;
      if (publishedForSource >= maxPerSource) break; // 1ソースの独占を防ぐ
      // カテゴリ上限に達していれば、このソース既定カテゴリはスキップ
      const lim = catLimits[source.category];
      if (lim && catCount[source.category] >= lim.max) break;

      candidatesFound++;

      // freshness: 過去 freshnessHours 以内を優先
      const ageH = hoursSince(it.publishedAt!);
      if (ageH > freshnessHours) continue;

      validatedForSource++;
      const v = await validateArticleUrl(it.link, source.baseUrl);
      if (!v.ok) { invalidUrlsRemoved++; continue; }

      // 公開日: フィード日時を優先、無ければHTML抽出 (spec §10)
      const pubIso = it.publishedAt || (v.publishedAt ? new Date(v.publishedAt).toISOString() : null);
      if (!pubIso) { invalidUrlsRemoved++; continue; } // 公開日不明は除外

      const bodyForSummary = v.bodyText || v.description || it.feedDescription;
      const hash = contentHash(v.title || it.title, bodyForSummary);

      const cand = {
        finalUrl: v.finalUrl, url: v.finalUrl, originalUrl: it.link,
        canonicalUrl: v.canonicalUrl, title: it.title, contentHash: hash,
      };
      if (isDuplicate(cand, seenUrls, seenHashes, seenTitleTokens)) { duplicatesRemoved++; continue; }

      const displayTitle = (v.title && v.title.length >= 5) ? v.title : it.title;

      // 要約・カテゴリ(単一)・タグ: LLMキーがあれば高精度に一括生成、無ければ抽出要約＋キーワード分類
      let summary = '';
      let summarySource: 'llm' | 'extractive' | 'feed_description' = 'extractive';
      let category = '';
      let tags: string[] = [];
      if (opts.llmKey) {
        const enriched = await llmEnrich(displayTitle, v.bodyText || v.description || it.feedDescription, source.name, opts.llmKey);
        if (enriched) {
          summary = enriched.summary; summarySource = enriched.summarySource;
          category = enriched.category; tags = enriched.tags;
        }
      }
      if (!summary) {
        const summaryRes = await summarize(v.bodyText, it.feedDescription || v.description, undefined);
        if (!summaryRes) { invalidUrlsRemoved++; continue; } // 要約不能なら公開しない (spec §9)
        summary = summaryRes.summary; summarySource = summaryRes.summarySource;
        category = classifyCategory(it.title, bodyForSummary, source.category);
        tags = extractTags(it.title, bodyForSummary, [category]);
      }

      // 各記事は単一カテゴリに属する
      const categories = [category];
      const primaryCat = catLimits[category] ? category : source.category;
      const cl = catLimits[primaryCat];
      if (cl && catCount[primaryCat] >= cl.max) { continue; }

      const now = nowJstIso();

      const article: Article = {
        id: v.finalUrl,
        title: displayTitle,
        originalTitle: it.title,
        summary,
        summarySource,
        source: source.name,
        sourceId: source.id,
        url: v.finalUrl,
        originalUrl: it.link,
        finalUrl: v.finalUrl,
        publishedAt: toJstIso(new Date(pubIso)),
        collectedAt: now,
        scrapedAt: now,
        lastVerifiedAt: now,
        httpStatus: v.httpStatus,
        contentType: v.contentType,
        linkStatus: v.linkStatus,
        validationError: null,
        category,
        categories,
        tags,
        thumbnailUrl: null,
        published: true,
        reliabilityScore: source.reliabilityScore,
        contentHash: hash,
        trendScore: trendScore(pubIso, it.bookmarkCount),
        createdAt: now,
        updatedAt: now,
      };

      registerSeen(cand, seenUrls, seenHashes, seenTitleTokens);
      catCount[primaryCat] = (catCount[primaryCat] || 0) + 1;
      publishedForSource++;
      out.push(article);
      if (out.length >= totalMax) break;
    }
    if (out.length >= totalMax) break;
  }

  return {
    articles: out,
    updatedSources,
    log: {
      sourcesAttempted: enabled.length,
      sourcesSucceeded,
      sourcesFailed,
      candidatesFound,
      duplicatesRemoved,
      invalidUrlsRemoved,
      articlesPublished: out.length,
      errors,
    },
  };
}

export { DEFAULT_CATEGORY_LIMITS };
