import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  parseGeneratePayload,
  runStoryGeneration,
  type GeneratePayload,
} from "@/lib/stories/run-story-generation";

export type StoryJobRow = {
  id: string;
  parent_id: string;
  status: "pending" | "running" | "ready" | "failed";
  theme: string;
  payload: GeneratePayload;
  story_id: string | null;
  error: string | null;
  progress: string | null;
  created_at: string;
  updated_at?: string;
  finished_at?: string | null;
};

async function db() {
  return createAdminClient() ?? (await createClient());
}

export async function enqueueStoryJob(input: {
  userId: string;
  body: Record<string, unknown>;
}): Promise<{ jobId?: string; error?: string }> {
  const parsed = parseGeneratePayload(input.body);
  if (parsed.error || !parsed.payload) {
    return { error: parsed.error || "Payload inválido." };
  }

  const client = await db();
  if (!client) return { error: "Banco indisponível." };

  const { data, error } = await client
    .from("story_jobs")
    .insert({
      parent_id: input.userId,
      status: "pending",
      theme: parsed.payload.theme,
      payload: parsed.payload,
      progress: "Na fila…",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { error: error?.message || "Falha ao enfileirar job." };
  }
  return { jobId: data.id };
}

export async function getStoryJobForUser(
  jobId: string,
  userId: string,
): Promise<StoryJobRow | null> {
  const client = await db();
  if (!client) return null;
  const { data } = await client
    .from("story_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("parent_id", userId)
    .maybeSingle();
  return (data as StoryJobRow | null) ?? null;
}

export async function listActiveJobsForUser(
  userId: string,
): Promise<StoryJobRow[]> {
  const client = await db();
  if (!client) return [];
  const { data } = await client
    .from("story_jobs")
    .select("*")
    .eq("parent_id", userId)
    .in("status", ["pending", "running", "ready"])
    .order("created_at", { ascending: false })
    .limit(10);
  return (data as StoryJobRow[]) ?? [];
}

/** Processa um job pending/running. Seguro para reentrada básica. */
export async function processStoryJob(jobId: string): Promise<{
  ok: boolean;
  status?: string;
  error?: string;
}> {
  const client = await db();
  if (!client) return { ok: false, error: "Banco indisponível." };

  const { data: job } = await client
    .from("story_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return { ok: false, error: "Job não encontrado." };
  if (job.status === "ready" || job.status === "failed") {
    return { ok: true, status: job.status };
  }
  if (job.status === "running") {
    // Evita double-run agressivo: se started_at < 8 min, sai.
    const started = job.started_at ? new Date(job.started_at).getTime() : 0;
    if (started && Date.now() - started < 8 * 60_000) {
      return { ok: true, status: "running" };
    }
  }

  await client
    .from("story_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      progress: "Gerando…",
      error: null,
    })
    .eq("id", jobId);

  const payload = (job.payload ?? {}) as GeneratePayload;
  if (!payload.theme) payload.theme = job.theme;

  try {
    const result = await runStoryGeneration({
      userId: job.parent_id,
      payload,
      onProgress: async (msg) => {
        await client
          .from("story_jobs")
          .update({ progress: msg })
          .eq("id", jobId);
      },
    });

    if (!result.ok) {
      await client
        .from("story_jobs")
        .update({
          status: "failed",
          error: result.error || "Falha na geração.",
          progress: "Falhou",
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      return { ok: false, error: result.error, status: "failed" };
    }

    await client
      .from("story_jobs")
      .update({
        status: "ready",
        story_id: result.storyId ?? null,
        progress: `Pronta: “${result.title ?? "História"}”`,
        finished_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", jobId);

    return { ok: true, status: "ready" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha inesperada na geração.";
    console.error("[story_jobs] process crash", jobId, err);
    await client
      .from("story_jobs")
      .update({
        status: "failed",
        error: message,
        progress: "Falhou",
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    return { ok: false, error: message, status: "failed" };
  }
}
