import type { Metadata, Viewport } from 'next';
import './globals.css';
import PWARegister from '@/components/PWARegister';

export const metadata: Metadata = {
  title: 'きづき | AI・社会の兆しキュレーション',
  description: '社会とAIに関する「兆し（トレンドの初期シグナル）」を実在の情報源から自動収集・要約し、パーソナライズして届けるニュースキュレーションアプリ。',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.ico' },
  appleWebApp: { capable: true, title: 'きづき', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
