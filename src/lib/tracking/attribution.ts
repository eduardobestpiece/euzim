import { cookies } from "next/headers";
import type { AttributionSnapshot } from "@/lib/tracking/types";

export const ATTRIBUTION_COOKIE = "euzim_attr";
export const ATTRIBUTION_MAX_AGE_SEC = 90 * 24 * 60 * 60;

const ATTR_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "fbc",
  "fbp",
  "referrer",
  "landing_path",
  "landing_query",
] as const;

export function parseAttributionJson(
  raw: string | null | undefined,
): AttributionSnapshot {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: AttributionSnapshot = {};
    for (const key of ATTR_KEYS) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) {
        out[key] = v.trim().slice(0, 500);
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function mergeAttribution(
  base: AttributionSnapshot,
  next: AttributionSnapshot,
): AttributionSnapshot {
  const out: AttributionSnapshot = { ...base };
  for (const key of ATTR_KEYS) {
    const v = next[key];
    if (typeof v === "string" && v.trim()) {
      out[key] = v.trim().slice(0, 500);
    }
  }
  return out;
}

/** Lê cookie de atribuição no servidor (Server Actions / Route Handlers). */
export async function readAttributionCookie(): Promise<AttributionSnapshot> {
  try {
    const jar = await cookies();
    return parseAttributionJson(jar.get(ATTRIBUTION_COOKIE)?.value);
  } catch {
    return {};
  }
}

export function buildFbcFromFbclid(
  fbclid: string | null | undefined,
  nowMs = Date.now(),
): string | null {
  if (!fbclid) return null;
  return `fb.1.${nowMs}.${fbclid}`;
}

/** Extrai query de attribution a partir de URLSearchParams / Record. */
export function attributionFromSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): AttributionSnapshot {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) {
      return params.get(key);
    }
    const v = params[key];
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };

  const snap: AttributionSnapshot = {};
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
  ] as const) {
    const v = get(key);
    if (v) snap[key] = v;
  }
  if (snap.fbclid && !snap.fbc) {
    snap.fbc = buildFbcFromFbclid(snap.fbclid) ?? undefined;
  }
  return snap;
}
