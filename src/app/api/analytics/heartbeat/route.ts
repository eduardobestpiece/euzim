import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SESSION_GAP_MS = 30 * 60 * 1000; // nova sessão após 30 min idle

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase off" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
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

    return NextResponse.json({
      ok: true,
      sessionId: recent.id,
      durationSeconds,
    });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sessionId: created.id, durationSeconds: 0 });
}
