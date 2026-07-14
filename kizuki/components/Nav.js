"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DarkModeToggle from "./DarkModeToggle.js";

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-slate-800 dark:text-slate-100">
          きづき
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/sources"
            className={`text-sm px-3 py-1.5 rounded-md hidden sm:inline-block ${
              pathname === "/sources"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            情報源
          </Link>
          <Link
            href="/status"
            className={`text-sm px-3 py-1.5 rounded-md hidden sm:inline-block ${
              pathname === "/status"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            バッチ状況
          </Link>
          <Link
            href="/bookmarks"
            aria-label="ブックマーク一覧"
            className={`text-lg px-2 py-1 rounded-md ${
              pathname === "/bookmarks"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
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
