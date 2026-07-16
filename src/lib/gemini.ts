import { GoogleGenerativeAI } from '@google/generative-ai';
import { Article } from './db';

/**
 * AIアシスタントのチャット (spec §20: 架空記事の生成禁止)。
 * APIキーが無い場合でも、実在の収集済み記事の一覧だけを提示し、
 * 事実として推測・分析を捏造しない。
 */
export async function chatWithKizuki(
  apiKey: string,
  question: string,
  recentArticles: Article[],
  chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[]
): Promise<string> {
  if (!apiKey) {
    const list = recentArticles.slice(0, 5)
      .map((a) => `- [${a.categories.join('/')}] ${a.title}（${a.source}） ${a.finalUrl || a.url}`)
      .join('\n');
    return [
      '**Gemini APIキーが未設定です。** 高精度な分析にはキー設定が必要です（右上の⚙️設定）。',
      '',
      'キー未設定のため、AIによる推測や分析は行いません。以下は現在収集済みの実在記事です:',
      '',
      list || '（現在、公開中の記事はありません。収集を実行してください）',
    ].join('\n');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const contextStr = recentArticles.slice(0, 15)
    .map((a, i) => `[記事 ${i + 1}]\nタイトル: ${a.title}\n要約: ${a.summary}\nカテゴリ: ${a.categories.join(', ')}\nタグ: ${a.tags.map((t) => '#' + t).join(' ')}\n出典: ${a.source} (${a.finalUrl || a.url})`)
    .join('\n\n');

  const systemInstruction = `あなたは社会とAIの「兆し」をキュレーションするアプリ「きづき」のアシスタントです。提供された実在記事のコンテキストに基づき、親切・的確・平易な日本語で答えてください。コンテキストに無い事実を断定せず、推測は推測と明示してください。マークダウンで読みやすくまとめてください。`;

  const chat = model.startChat({ history: chatHistory, systemInstruction });
  try {
    const result = await chat.sendMessage(`【コンテキスト（実在する兆し記事）】\n${contextStr}\n\n【質問】\n${question}`);
    return result.response.text();
  } catch (e) {
    console.error('Gemini chat error:', e);
    return 'Gemini APIとの通信でエラーが発生しました。キーの有効性や時間をおいて再度お試しください。';
  }
}
