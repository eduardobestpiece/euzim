import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PublicTrackingConfig,
  TrackingPixelRow,
  TrackingTagRow,
  TrackingWebhookRow,
} from "@/lib/tracking/types";

function asLabels(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

export async function loadTrackingPixels(
  opts: { includeSecrets?: boolean } = {},
): Promise<TrackingPixelRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  // Tabelas podem ainda não existir no tipagem gerada — select * + cast.
  const { data, error } = await admin
    .from("tracking_pixels")
    .select("*")
    .eq("is_active", true);

  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    kind: row.kind as TrackingPixelRow["kind"],
    label: String(row.label || ""),
    is_active: Boolean(row.is_active),
    pixel_id: (row.pixel_id as string | null) ?? null,
    capi_access_token: opts.includeSecrets
      ? ((row.capi_access_token as string | null) ?? null)
      : undefined,
    aw_id: (row.aw_id as string | null) ?? null,
    conversion_labels: asLabels(row.conversion_labels),
    measurement_id: (row.measurement_id as string | null) ?? null,
  }));
}

export async function loadAllTrackingPixelsAdmin(): Promise<TrackingPixelRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("tracking_pixels")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    kind: row.kind as TrackingPixelRow["kind"],
    label: String(row.label || ""),
    is_active: Boolean(row.is_active),
    pixel_id: (row.pixel_id as string | null) ?? null,
    capi_access_token: (row.capi_access_token as string | null) ?? null,
    aw_id: (row.aw_id as string | null) ?? null,
    conversion_labels: asLabels(row.conversion_labels),
    measurement_id: (row.measurement_id as string | null) ?? null,
  }));
}

export async function loadTrackingTags(
  activeOnly = true,
): Promise<TrackingTagRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  let q = admin.from("tracking_tags").select("*");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q.order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    name: String(row.name || ""),
    html: String(row.html || ""),
    is_active: Boolean(row.is_active),
  }));
}

export async function loadTrackingWebhooks(
  activeOnly = true,
): Promise<TrackingWebhookRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  let q = admin.from("tracking_webhooks").select("*");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q.order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    label: String(row.label || ""),
    url: String(row.url || ""),
    secret: (row.secret as string | null) ?? null,
    is_active: Boolean(row.is_active),
    events: Array.isArray(row.events) ? row.events.map(String) : [],
  }));
}

export async function loadPublicTrackingConfig(): Promise<PublicTrackingConfig> {
  const [pixels, tags] = await Promise.all([
    loadTrackingPixels({ includeSecrets: false }),
    loadTrackingTags(true),
  ]);

  const metaPixelIds = pixels
    .filter((p) => p.kind === "meta" && p.pixel_id)
    .map((p) => p.pixel_id as string);

  const googleAds = pixels
    .filter((p) => p.kind === "google_ads" && p.aw_id)
    .map((p) => ({
      awId: p.aw_id as string,
      labels: p.conversion_labels || {},
    }));

  const ga4Ids = pixels
    .filter((p) => p.kind === "ga4" && p.measurement_id)
    .map((p) => p.measurement_id as string);

  return {
    metaPixelIds,
    googleAds,
    ga4Ids,
    tags: tags.map((t) => ({ id: t.id, name: t.name, html: t.html })),
  };
}
