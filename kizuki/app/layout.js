import "./globals.css";
import Nav from "@/components/Nav.js";

export const metadata = {
  title: "きづき",
  description: "個人用: AI・社会の「兆し」を毎日キャッチアップするキュレーションアプリ",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "きづき",
  },
};

export const viewport = {
  themeColor: "#F27A9C",
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

// 要件: スマホのホーム画面に追加して使うことを目標とするPWA構成。
// サービスワーカー登録は失敗してもアプリ本体の動作に影響しないようにする。
const swRegisterScript = `
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}
`;

export default function RootLayout({ children }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700;800&family=Zen+Maru+Gothic:wght@500;700;900&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Nav />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">{children}</main>
        <footer className="text-center text-xs opacity-50 py-4">
          個人用ツール / AI・社会兆しキュレーションアプリ「きづき」
        </footer>
        <script dangerouslySetInnerHTML={{ __html: swRegisterScript }} />
      </body>
    </html>
  );
}
