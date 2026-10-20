"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const INTERVAL_MS = 90_000;

/** Heartbeat ~90s → last_active_at + analytics_sessions (sem re-disparar a cada rota). */
export function SessionHeartbeat() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    let cancelled = false;

    async function beat() {
      if (cancelled) return;
      try {
        await fetch("/api/analytics/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: pathRef.current || "/app" }),
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
  }, []);

  return null;
}
