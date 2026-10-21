import { readAttributionCookie, mergeAttribution } from "@/lib/tracking/attribution";
import { sendGa4MeasurementProtocol } from "@/lib/tracking/ga4-mp";
import {
  loadTrackingPixels,
  loadTrackingWebhooks,
} from "@/lib/tracking/load-config";
import { sendMetaCapi } from "@/lib/tracking/meta-capi";
import { dispatchOutboundWebhooks } from "@/lib/tracking/webhooks";
import type { TrackingEventInput } from "@/lib/tracking/types";

export function newEventId(): string {
  return crypto.randomUUID();
}

/**
 * Pipeline servidor: Meta CAPI + GA4 MP + webhooks outbound.
 * Browser pixels ficam no client (mesmo event_id).
 */
export async function dispatchTrackingEvent(
  input: TrackingEventInput,
): Promise<{ eventId: string; ok: boolean }> {
  const eventId = input.eventId || newEventId();
  const cookieAttr = await readAttributionCookie();
  const attribution = mergeAttribution(cookieAttr, input.attribution || {});

  const enriched: TrackingEventInput = {
    ...input,
    eventId,
    attribution,
  };

  const [pixels, webhooks] = await Promise.all([
    loadTrackingPixels({ includeSecrets: true }),
    loadTrackingWebhooks(true),
  ]);

  const [capi] = await Promise.all([
    sendMetaCapi(pixels, enriched),
    sendGa4MeasurementProtocol(pixels, enriched),
    dispatchOutboundWebhooks(webhooks, enriched),
  ]);

  return { eventId, ok: capi.ok };
}

/** Disparo fire-and-forget (signup / onboard / stripe) sem bloquear UX. */
export function fireTrackingEvent(input: TrackingEventInput): void {
  void dispatchTrackingEvent(input).catch(() => {
    /* never throw to callers */
  });
}
