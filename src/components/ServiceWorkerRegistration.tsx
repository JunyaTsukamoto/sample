"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // PWA機能はベストエフォート。登録失敗してもアプリ自体は動作する。
      });
    }
  }, []);

  return null;
}
