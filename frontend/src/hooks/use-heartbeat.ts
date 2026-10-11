"use client";
import { useEffect } from "react";
import { api } from "@/lib/api";

const INTERVAL_MS = 30_000;

/** Records active study time: counts 30s whenever the tab is visible and focused. */
export function useHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        api.progress.heartbeat(INTERVAL_MS / 1000).catch(() => undefined);
      }
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled]);
}
