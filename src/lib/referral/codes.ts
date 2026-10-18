import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/config";

function randomCode(length = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

function isMissingReferralColumn(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("referral_code") &&
    (m.includes("does not exist") ||
      m.includes("could not find") ||
      m.includes("42703") ||
      m.includes("schema cache"))
  );
}

type NotesBag = {
  referral_code?: string;
  [key: string]: unknown;
};

function parseNotes(raw: unknown): NotesBag {
  if (raw == null) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as NotesBag;
  }
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as NotesBag;
    }
  } catch {
    /* plain text notes */
  }
  return { _legacy_notes: raw };
}

function notesCode(raw: unknown): string | null {
  const code = parseNotes(raw).referral_code;
  return typeof code === "string" && code.length > 0 ? code : null;
}

function mergeNotes(raw: unknown, code: string): string {
  const base = parseNotes(raw);
  return JSON.stringify({ ...base, referral_code: code });
}

async function authMetaCode(userId: string): Promise<string | null> {
  const { url, secretKey } = getSupabaseEnv();
  if (!url || !secretKey) return null;
  try {
    const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      user_metadata?: { referral_code?: string };
    };
    const code = body.user_metadata?.referral_code;
    return typeof code === "string" && code.length > 0 ? code : null;
  } catch {
    return null;
  }
}

async function writeAuthMetaCode(userId: string, code: string): Promise<void> {
  const { url, secretKey } = getSupabaseEnv();
  if (!url || !secretKey) return;
  try {
    const getRes = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!getRes.ok) return;
    const body = (await getRes.json()) as {
      user_metadata?: Record<string, unknown>;
    };
    const meta = { ...(body.user_metadata ?? {}), referral_code: code };
    await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_metadata: meta }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    /* best effort */
  }
}

/**
 * Garante referral_code e persiste.
 * Preferência: coluna users.referral_code (SQL em docs/referral-gifts-migration.sql).
 * Fallback se a coluna ainda não existir: admin_notes JSON + user_metadata.
 */
export async function ensureReferralCode(userId: string): Promise<string | null> {
  if (!userId) return null;
  const db = createAdminClient() ?? (await createClient());
  if (!db) return null;

  const { data: row, error: selectError } = await db
    .from("users")
    .select("id, referral_code, admin_notes")
    .eq("id", userId)
    .maybeSingle();

  if (selectError && isMissingReferralColumn(selectError.message)) {
    const { data: fallbackRow, error: fallbackErr } = await db
      .from("users")
      .select("id, admin_notes")
      .eq("id", userId)
      .maybeSingle();
    if (fallbackErr || !fallbackRow) {
      const metaOnly = await authMetaCode(userId);
      if (metaOnly) return metaOnly;
      const code = randomCode(8);
      await writeAuthMetaCode(userId, code);
      return code;
    }
    const fromNotes = notesCode(fallbackRow.admin_notes);
    if (fromNotes) return fromNotes;
    const fromMeta = await authMetaCode(userId);
    if (fromMeta) {
      await db
        .from("users")
        .update({ admin_notes: mergeNotes(fallbackRow.admin_notes, fromMeta) })
        .eq("id", userId);
      return fromMeta;
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = randomCode(8);
      const { error } = await db
        .from("users")
        .update({ admin_notes: mergeNotes(fallbackRow.admin_notes, code) })
        .eq("id", userId);
      if (!error) {
        await writeAuthMetaCode(userId, code);
        return code;
      }
    }
    const code = randomCode(8);
    await writeAuthMetaCode(userId, code);
    return code;
  }

  if (selectError) return null;
  if (!row) {
    const metaOnly = await authMetaCode(userId);
    if (metaOnly) return metaOnly;
    const code = randomCode(8);
    await writeAuthMetaCode(userId, code);
    return code;
  }

  const existing =
    typeof row.referral_code === "string" && row.referral_code.length > 0
      ? row.referral_code
      : notesCode(row.admin_notes);
  if (existing) {
    if (!row.referral_code) {
      await db
        .from("users")
        .update({ referral_code: existing })
        .eq("id", userId);
    }
    return existing;
  }

  const fromMeta = await authMetaCode(userId);
  if (fromMeta) {
    await db
      .from("users")
      .update({ referral_code: fromMeta })
      .eq("id", userId);
    return fromMeta;
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode(8);
    const { error } = await db
      .from("users")
      .update({ referral_code: code })
      .eq("id", userId);
    if (!error) {
      await writeAuthMetaCode(userId, code);
      return code;
    }
    if (isMissingReferralColumn(error.message)) {
      const { error: notesErr } = await db
        .from("users")
        .update({ admin_notes: mergeNotes(row.admin_notes, code) })
        .eq("id", userId);
      if (!notesErr) {
        await writeAuthMetaCode(userId, code);
        return code;
      }
      await writeAuthMetaCode(userId, code);
      return code;
    }
    if (!error.message.toLowerCase().includes("unique")) {
      return null;
    }
  }
  return null;
}

export async function findUserIdByReferralCode(
  code: string,
): Promise<string | null> {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  const db = createAdminClient() ?? (await createClient());
  if (!db) return null;

  const { data, error } = await db
    .from("users")
    .select("id")
    .eq("referral_code", normalized)
    .maybeSingle();

  if (!error && data?.id) return data.id;

  const { data: notesRows } = await db
    .from("users")
    .select("id, admin_notes")
    .ilike("admin_notes", `%"referral_code":"${normalized}"%`)
    .limit(5);

  for (const row of notesRows ?? []) {
    if (notesCode(row.admin_notes) === normalized) return row.id;
  }

  const { url, secretKey } = getSupabaseEnv();
  if (!url || !secretKey) return null;
  try {
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(
        `${url}/auth/v1/admin/users?page=${page}&per_page=200`,
        {
          headers: {
            apikey: secretKey,
            Authorization: `Bearer ${secretKey}`,
          },
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (!res.ok) break;
      const body = (await res.json()) as {
        users?: { id: string; user_metadata?: { referral_code?: string } }[];
      };
      const users = body.users ?? [];
      for (const u of users) {
        if (u.user_metadata?.referral_code === normalized) return u.id;
      }
      if (users.length < 200) break;
    }
  } catch {
    /* ignore */
  }
  return null;
}
