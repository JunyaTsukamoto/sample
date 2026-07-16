import { runPipeline } from '../src/lib/collector/pipeline.ts';
const base = `http://127.0.0.1:${process.env.FIX_PORT||4599}`;
const sources = [{id:'fix-ai',name:'テストメディア',baseUrl:`${base}/`,feedUrl:`${base}/feed.xml`,type:'rss',category:'AI',enabled:true,reliabilityScore:0.8,lastFetchedAt:null,lastSuccessAt:null,consecutiveFailures:0}];
const r = await runPipeline(sources as any, [], { freshnessHours:72 });
console.log('--- LOG ---');
console.log(JSON.stringify(r.log,null,2));
console.log(`--- ARTICLES (${r.articles.length}) ---`);
for (const a of r.articles) {
  console.log('•', a.linkStatus, '|', a.categories.join(','), '|', a.title);
  console.log('   url:', a.finalUrl, '| pub:', a.publishedAt);
  console.log('   sum('+a.summarySource+'):', a.summary.slice(0,70));
}
