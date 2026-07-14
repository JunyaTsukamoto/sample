import "./globals.css";
import Nav from "@/components/Nav.js";

export const metadata = {
  title: "きづき",
  description: "個人用: AI・社会の「兆し」を毎日キャッチアップするキュレーションアプリ",
};

// デフォルトはライトモード。localStorageに保存済みの選択があればそれを優先する。
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("kizuki-theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <Nav />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">{children}</main>
        <footer className="text-center text-xs text-slate-400 dark:text-slate-600 py-4">
          個人用ツール / AI・社会兆しキュレーションアプリ「きづき」
        </footer>
      </body>
    </html>
  );
}
