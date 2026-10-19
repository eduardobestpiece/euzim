"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadAllTrackingPixelsAdmin,
  loadTrackingTags,
  loadTrackingWebhooks,
} from "@/lib/tracking/load-config";
import { TRACKING_EVENT_KEYS } from "@/lib/tracking/types";

export type PixelsAdminBundle = {
  pixels: Awaited<ReturnType<typeof loadAllTrackingPixelsAdmin>>;
  tags: Awaited<ReturnType<typeof loadTrackingTags>>;
  webhooks: Awaited<ReturnType<typeof loadTrackingWebhooks>>;
  error?: string;
};

async function adminDb() {
  const gate = await requireAdmin();
  if ("error" in gate) return { error: gate.error } as const;
  const admin = createAdminClient();
  if (!admin) return { error: "Admin indisponível." } as const;
  return { admin } as const;
}

export async function loadPixelsAdminAction(): Promise<PixelsAdminBundle> {
  const ctx = await adminDb();
  if ("error" in ctx) {
    return { pixels: [], tags: [], webhooks: [], error: ctx.error };
  }
  const [pixels, tags, webhooks] = await Promise.all([
    loadAllTrackingPixelsAdmin(),
    loadTrackingTags(false),
    loadTrackingWebhooks(false),
  ]);
  return { pixels, tags, webhooks };
}

export async function upsertTrackingPixelAction(input: {
  id?: string;
  kind: "meta" | "google_ads" | "ga4";
  label: string;
  isActive: boolean;
  pixelId?: string;
  capiAccessToken?: string;
  awId?: string;
  conversionLabels?: Record<string, string>;
  measurementId?: string;
}): Promise<{ error?: string; success?: boolean }> {
  const ctx = await adminDb();
  if ("error" in ctx) return { error: ctx.error };

  const row = {
    kind: input.kind,
    label: input.label.trim().slice(0, 120),
    is_active: input.isActive,
    pixel_id: input.kind === "meta" ? input.pixelId?.trim() || null : null,
    capi_access_token:
      input.kind === "meta" ? input.capiAccessToken?.trim() || null : null,
    aw_id: input.kind === "google_ads" ? input.awId?.trim() || null : null,
    conversion_labels:
      input.kind === "google_ads" ? input.conversionLabels || {} : {},
    measurement_id:
      input.kind === "ga4" ? input.measurementId?.trim() || null : null,
  };

  if (input.id) {
    const { error } = await ctx.admin
      .from("tracking_pixels")
      .update(row)
      .eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await ctx.admin.from("tracking_pixels").insert(row);
    if (error) return { error: error.message };
  }
  revalidatePath("/app/admin");
  return { success: true };
}

export async function deleteTrackingPixelAction(id: string): Promise<{
  error?: string;
  success?: boolean;
}> {
  const ctx = await adminDb();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.admin.from("tracking_pixels").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/app/admin");
  return { success: true };
}

export async function upsertTrackingTagAction(input: {
  id?: string;
  name: string;
  html: string;
  isActive: boolean;
}): Promise<{ error?: string; success?: boolean }> {
  const ctx = await adminDb();
  if ("error" in ctx) return { error: ctx.error };
  const row = {
    name: input.name.trim().slice(0, 120) || "Tag",
    html: input.html,
    is_active: input.isActive,
  };
  if (input.id) {
    const { error } = await ctx.admin
      .from("tracking_tags")
      .update(row)
      .eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await ctx.admin.from("tracking_tags").insert(row);
    if (error) return { error: error.message };
  }
  revalidatePath("/app/admin");
  return { success: true };
}

export async function deleteTrackingTagAction(id: string): Promise<{
  error?: string;
  success?: boolean;
}> {
  const ctx = await adminDb();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.admin.from("tracking_tags").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/app/admin");
  return { success: true };
}

export async function upsertTrackingWebhookAction(input: {
  id?: string;
  label: string;
  url: string;
  secret?: string;
  isActive: boolean;
  events: string[];
}): Promise<{ error?: string; success?: boolean }> {
  const ctx = await adminDb();
  if ("error" in ctx) return { error: ctx.error };

  try {
    // eslint-disable-next-line no-new
    new URL(input.url);
  } catch {
    return { error: "URL do webhook inválida." };
  }

  const events = input.events.filter((e) =>
    (TRACKING_EVENT_KEYS as string[]).includes(e),
  );

  const row = {
    label: input.label.trim().slice(0, 120),
    url: input.url.trim(),
    secret: input.secret?.trim() || null,
    is_active: input.isActive,
    events,
  };

  if (input.id) {
    const { error } = await ctx.admin
      .from("tracking_webhooks")
      .update(row)
      .eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await ctx.admin.from("tracking_webhooks").insert(row);
    if (error) return { error: error.message };
  }
  revalidatePath("/app/admin");
  return { success: true };
}

export async function deleteTrackingWebhookAction(id: string): Promise<{
  error?: string;
  success?: boolean;
}> {
  const ctx = await adminDb();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.admin
    .from("tracking_webhooks")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/app/admin");
  return { success: true };
}
