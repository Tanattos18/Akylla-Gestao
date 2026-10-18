"use client";

import { useEffect } from "react";

/** Registra o service worker do PWA (só em produção, para não atrapalhar o dev). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sem service worker o sistema funciona igual; só não instala como app
    });
  }, []);
  return null;
}
