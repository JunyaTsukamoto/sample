import { NextRequest, NextResponse } from 'next/server';
import { chatWithKizuki } from '@/lib/gemini';
import { getSettings, getArticles } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { question, history } = await request.json();

    if (!question) {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 });
    }

    const settings = getSettings();
    const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey || '';
    
    // Sort articles chronologically to get the most recent ones for context
    const articles = getArticles()
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 15);

    const chatResponse = await chatWithKizuki(
      apiKey,
      question,
      articles,
      history || []
    );

    return NextResponse.json({
      success: true,
      response: chatResponse,
    });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
