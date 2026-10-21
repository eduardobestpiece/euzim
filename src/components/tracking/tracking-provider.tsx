"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  captureAttributionFromLocation,
  initBrowserPixels,
  trackBrowserEvent,
} from "@/lib/tracking/client-browser";
import type { PublicTrackingConfig } from "@/lib/tracking/types";

export function TrackingProvider({
  config,
  userId,
  email,
}: {
  config: PublicTrackingConfig;
  userId?: string | null;
  email?: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ready = useRef(false);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    captureAttributionFromLocation();
    initBrowserPixels(config);
    ready.current = true;
  }, [config]);

  useEffect(() => {
    if (!ready.current) return;
    captureAttributionFromLocation();
    const key = `${pathname}?${searchParams?.toString() || ""}`;
    if (lastPath.current === key) return;
    lastPath.current = key;
    void trackBrowserEvent({
      event: "PageView",
      user: { userId: userId || undefined, email: email || undefined },
      mirrorServer: true,
    });
  }, [pathname, searchParams, userId, email]);

  return null;
}
