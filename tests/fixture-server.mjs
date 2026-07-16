import http from 'http';
// 実在サイトを模したローカル検証サーバ（loopback）。実HTTP/リダイレクト/404/検索/トップを再現。
const PORT = process.env.FIX_PORT || 4599;
const base = `http://127.0.0.1:${PORT}`;

const article = (title, body, published) => `<!doctype html><html lang="ja"><head>
<meta charset="utf-8"><title>${title} | テストメディア</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${body.slice(0,80)}">
<meta property="article:published_time" content="${published}">
</head><body><header>ナビ</header><article><h1>${title}</h1><p>${body}</p></article><footer>c</footer></body></html>`;

const now = new Date();
const iso = (h)=> new Date(now.getTime()-h*3600000).toISOString();

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>テストメディア</title><link>${base}/</link>
<item><title>生成AIの新しい研究成果を大学が発表</title><link>${base}/articles/ai-research</link><pubDate>${iso(5)}</pubDate><description>大学の研究チームが生成AIに関する新手法を公開した。</description></item>
<item><title>デジタル庁が新しい行政手続きのガイドライン制度を公開</title><link>${base}/articles/gov-policy</link><pubDate>${iso(10)}</pubDate><description>行政手続のオンライン化に関する新制度のガイドライン。</description></item>
<item><title>スタートアップがシリーズAで資金調達を実施</title><link>${base}/articles/startup-funding</link><pubDate>${iso(20)}</pubDate><description>新事業のスタートアップが資金調達を発表。</description></item>
<item><title>この記事はリンク切れ（404）になる</title><link>${base}/articles/missing</link><pubDate>${iso(3)}</pubDate><description>存在しない記事。</description></item>
<item><title>移転した記事（リダイレクト）</title><link>${base}/old/moved</link><pubDate>${iso(4)}</pubDate><description>別URLへ移動。</description></item>
<item><title>トップページに飛ぶ不正な記事リンク</title><link>${base}/</link><pubDate>${iso(2)}</pubDate><description>トップ。</description></item>
<item><title>検索結果ページに飛ぶ記事リンク</title><link>${base}/search?q=ai</link><pubDate>${iso(2)}</pubDate><description>検索。</description></item>
<item><title>生成AIの新しい研究成果を大学が発表</title><link>${base}/articles/ai-research-dup?utm_source=x</link><pubDate>${iso(5)}</pubDate><description>重複記事（同一タイトル/内容）。</description></item>
<item><title>古すぎる記事（10日前）</title><link>${base}/articles/too-old</link><pubDate>${iso(240)}</pubDate><description>freshness外。</description></item>
</channel></rss>`;

const server = http.createServer((req,res)=>{
  const u = new URL(req.url, base);
  const p = u.pathname;
  const send=(code,type,body)=>{res.writeHead(code,{'content-type':type});res.end(body);};
  if(p==='/feed.xml') return send(200,'application/rss+xml; charset=utf-8', rss);
  if(p==='/') return send(200,'text/html','<!doctype html><html><head><title>テストメディア トップ</title></head><body><main>トップページ。最新記事一覧。</main></body></html>');
  if(p==='/search') return send(200,'text/html', article('検索結果','検索結果ページです。',iso(2)));
  if(p==='/articles/missing') return send(404,'text/html','<html><head><title>404 Not Found</title></head><body>ページが見つかりません</body></html>');
  if(p==='/old/moved'){res.writeHead(301,{location:`${base}/articles/moved-final`});return res.end();}
  if(p==='/articles/moved-final') return send(200,'text/html', article('移転先の記事本文','これは正式に移転した記事の本文です。十分な長さの日本語本文が含まれており、研究に関する内容を扱っています。',iso(4)));
  if(p==='/articles/ai-research'||p==='/articles/ai-research-dup') return send(200,'text/html', article('生成AIの新しい研究成果','大学の研究チームが生成AIの新しい学習手法を開発し、論文を公開した。実験では既存手法を上回る精度を確認したという。今後の応用が期待される。',iso(5)));
  if(p==='/articles/gov-policy') return send(200,'text/html', article('行政手続きの新ガイドライン','デジタル庁は行政手続きのオンライン化に関する新しいガイドライン制度を公表した。自治体向けの標準仕様を示し、来年度からの適用を目指す。',iso(10)));
  if(p==='/articles/startup-funding') return send(200,'text/html', article('スタートアップが資金調達','新事業を手がけるスタートアップがシリーズAで大型の資金調達を実施したと発表した。調達資金は製品開発と採用に充てる。',iso(20)));
  if(p==='/articles/too-old') return send(200,'text/html', article('古い記事','10日前の記事本文。十分な長さのテキストがここに入ります。'.repeat(2),iso(240)));
  return send(404,'text/html','<title>404</title>not found');
});
server.listen(PORT, ()=>console.log('fixture on '+base));
