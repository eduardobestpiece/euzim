import { Suspense } from "react";
import { connection } from "next/server";
import { TrackingProvider } from "@/components/tracking/tracking-provider";
import { loadPublicTrackingConfig } from "@/lib/tracking/load-config";
import type { PublicTrackingConfig } from "@/lib/tracking/types";

const EMPTY_CONFIG: PublicTrackingConfig = {
  metaPixelIds: [],
  googleAds: [],
  ga4Ids: [],
  tags: [],
};

async function loadConfigFast(): Promise<PublicTrackingConfig> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raced = await Promise.race([
      loadPublicTrackingConfig(),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), 2000);
      }),
    ]);
    if (raced === "timeout") return EMPTY_CONFIG;
    return raced;
  } catch {
    return EMPTY_CONFIG;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function TrackingShellInner() {
  await connection();
  // Sem getCurrentUser aqui — Auth/DB no layout raiz travava /login (10–50s).
  // userId no PageView é opcional; pixels/UTM funcionam sem ele.
  const config = await loadConfigFast();
  return <TrackingProvider config={config} />;
}

export function TrackingShell() {
  return (
    <Suspense fallback={null}>
      <TrackingShellInner />
    </Suspense>
  );
}
