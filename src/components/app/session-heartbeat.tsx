"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const INTERVAL_MS = 60_000;

/** Heartbeat ~60s → last_active_at + analytics_sessions */
export function SessionHeartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function beat() {
      if (cancelled) return;
      try {
        await fetch("/api/analytics/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: pathname || "/app" }),
          credentials: "same-origin",
        });
      } catch {
        // ignore
      }
    }

    void beat();
    const id = window.setInterval(() => void beat(), INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pathname]);

  return null;
}
