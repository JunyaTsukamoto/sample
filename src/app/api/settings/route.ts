import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/db';

export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json({ success: true, settings: { mutationRate: settings.mutationRate, geminiApiKey: '' } });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // APIキーはファイルDBへ保存しない（GitHub等への漏洩防止）。キーは環境変数で設定する。
    if ('geminiApiKey' in body) delete body.geminiApiKey;
    const updatedSettings = saveSettings(body);
    
    return NextResponse.json({ success: true, settings: { mutationRate: updatedSettings.mutationRate, geminiApiKey: '' } });
  } catch (error: any) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
