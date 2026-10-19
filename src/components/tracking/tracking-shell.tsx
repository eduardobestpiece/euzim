import { Suspense } from "react";
import { connection } from "next/server";
import { TrackingProvider } from "@/components/tracking/tracking-provider";
import { getCurrentUser } from "@/lib/auth/get-user";
import { loadPublicTrackingConfig } from "@/lib/tracking/load-config";

async function TrackingShellInner() {
  await connection();
  const [config, user] = await Promise.all([
    loadPublicTrackingConfig(),
    getCurrentUser(),
  ]);

  const hasAnything =
    config.metaPixelIds.length > 0 ||
    config.ga4Ids.length > 0 ||
    config.googleAds.length > 0 ||
    config.tags.length > 0;

  // Sempre monta o provider para capturar UTM mesmo sem pixels
  return (
    <TrackingProvider
      config={hasAnything ? config : { ...config }}
      userId={user?.id}
      email={user?.email}
    />
  );
}

export function TrackingShell() {
  return (
    <Suspense fallback={null}>
      <TrackingShellInner />
    </Suspense>
  );
}
