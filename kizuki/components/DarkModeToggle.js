"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "kizuki-theme";

export default function DarkModeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label="ダークモード切り替え"
      className="text-sm px-2 py-1.5 rounded-full border border-black/10 dark:border-white/15 opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
    >
      {dark ? "☀️ ライト" : "🌙 ダーク"}
    </button>
  );
}
