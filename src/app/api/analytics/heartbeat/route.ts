import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SESSION_GAP_MS = 30 * 60 * 1000; // nova sessão após 30 min idle
/** Cap duro: heartbeat lento não pode engolir o event loop da :5050. */
const HEARTBEAT_BUDGET_MS = 4_000;

async function withBudget<T>(
  ms: number,
  work: () => Promise<T>,
): Promise<T | "timeout"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase off" }, { status: 503 });
  }

  // getSession = cookies locais (sem round-trip Auth). Heartbeat não precisa
  // revalidar JWT no GoTrue — evita saturar a :5050 (~5–16s por getUser).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let pathSample = "/app";
  try {
    const body = (await request.json()) as { path?: string };
    if (body.path && typeof body.path === "string") {
      pathSample = body.path.slice(0, 200);
    }
  } catch {
    // empty body ok
  }

  const result = await withBudget(HEARTBEAT_BUDGET_MS, async () => {
    const db = createAdminClient() ?? supabase;
    const now = new Date();
    const nowIso = now.toISOString();

    await db
      .from("users")
      .update({ last_active_at: nowIso })
      .eq("id", user.id);

    const { data: recent } = await db
      .from("analytics_sessions")
      .select("id, started_at, last_seen_at")
      .eq("user_id", user.id)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastSeen = recent?.last_seen_at
      ? new Date(recent.last_seen_at).getTime()
      : 0;
    const continueSession =
      recent?.id && now.getTime() - lastSeen < SESSION_GAP_MS;

    if (continueSession && recent) {
      const started = new Date(recent.started_at).getTime();
      const durationSeconds = Math.max(
        0,
        Math.floor((now.getTime() - started) / 1000),
      );
      await db
        .from("analytics_sessions")
        .update({
          last_seen_at: nowIso,
          duration_seconds: durationSeconds,
          path_sample: pathSample,
        })
        .eq("id", recent.id);

      return {
        ok: true as const,
        sessionId: recent.id,
        durationSeconds,
      };
    }

    const { data: created, error } = await db
      .from("analytics_sessions")
      .insert({
        user_id: user.id,
        started_at: nowIso,
        last_seen_at: nowIso,
        duration_seconds: 0,
        path_sample: pathSample,
      })
      .select("id")
      .single();

    if (error) {
      return { ok: false as const, error: error.message };
    }

    return {
      ok: true as const,
      sessionId: created.id,
      durationSeconds: 0,
    };
  });

  if (result === "timeout") {
    // Melhor responder fraco do que travar login/HMR por 30s+.
    return NextResponse.json({ ok: true, degraded: true }, { status: 202 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    sessionId: result.sessionId,
    durationSeconds: result.durationSeconds,
  });
}
