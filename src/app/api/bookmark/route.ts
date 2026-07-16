import { NextRequest, NextResponse } from 'next/server';
import { toggleBookmark } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { articleId } = await request.json();

    if (!articleId) {
      return NextResponse.json({ error: 'Missing articleId' }, { status: 400 });
    }

    const updatedBookmarks = toggleBookmark(articleId);

    return NextResponse.json({
      success: true,
      bookmarks: updatedBookmarks,
    });
  } catch (error: any) {
    console.error('Error toggling article bookmark:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
