import { NextRequest, NextResponse } from 'next/server';
import { getArticles, updatePreference, readDb, writeDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check for preference reset request
    if (body.reset) {
      const db = readDb();
      db.preferences = {
        categories: {
          'AI': 1.0,
          '制度': 1.0,
          '社会×データ': 1.0,
          '学術': 1.0,
          '新事業': 1.0,
        },
        tags: {},
      };
      writeDb(db);
      return NextResponse.json({
        success: true,
        preferences: db.preferences,
      });
    }

    const { articleId, isLike } = body;

    if (!articleId) {
      return NextResponse.json({ error: 'Missing articleId' }, { status: 400 });
    }

    const articles = getArticles();
    const article = articles.find(a => a.id === articleId);

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    let updatedPreferences: any = null;

    // 1. Update preference weights for the article's categories
    if (article.categories && article.categories.length > 0) {
      for (const cat of article.categories) {
        updatedPreferences = updatePreference('categories', cat, isLike);
      }
    }

    // 2. Update preference weights for the article's tags
    if (article.tags && article.tags.length > 0) {
      for (const tag of article.tags) {
        updatedPreferences = updatePreference('tags', tag, isLike);
      }
    }

    return NextResponse.json({
      success: true,
      preferences: updatedPreferences,
    });
  } catch (error: any) {
    console.error('Error processing article feedback:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
