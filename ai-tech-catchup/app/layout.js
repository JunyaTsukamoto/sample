import "./globals.css";
import Nav from "@/components/Nav.js";

export const metadata = {
  title: "AI技術動向キャッチアップ",
  description: "個人用: AI・技術分野の最新動向を毎朝キャッチアップするためのアプリ",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Nav />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
          {children}
        </main>
        <footer className="text-center text-xs text-slate-400 py-4">
          個人用ツール / AI技術動向キャッチアップアプリ
        </footer>
      </body>
    </html>
  );
}
