"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DarkModeToggle from "./DarkModeToggle.js";

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-black/20 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-heading font-bold text-lg text-accent">
          きづき
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/sources"
            className={`text-sm px-3 py-1.5 rounded-full hidden sm:inline-block ${
              pathname === "/sources"
                ? "bg-accent text-accent-foreground"
                : "opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            情報源
          </Link>
          <Link
            href="/status"
            className={`text-sm px-3 py-1.5 rounded-full hidden sm:inline-block ${
              pathname === "/status"
                ? "bg-accent text-accent-foreground"
                : "opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            バッチ状況
          </Link>
          <Link
            href="/bookmarks"
            aria-label="ブックマーク一覧"
            className={`text-lg px-2 py-1 rounded-full ${
              pathname === "/bookmarks"
                ? "bg-accent text-accent-foreground"
                : "opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            🔖
          </Link>
          <DarkModeToggle />
        </div>
      </div>
    </header>
  );
}
