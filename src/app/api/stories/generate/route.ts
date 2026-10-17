import { NextResponse, after } from "next/server";
import { MONTHLY_STORY_LIMIT } from "@/lib/billing/character-packs";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getStoryUsage } from "@/lib/stories/usage";
import { countMockStoriesThisMonth } from "@/lib/stories/mock-store";
import { enqueueStoryJob, processStoryJob } from "@/lib/stories/story-jobs";

export const maxDuration = 300;

/**
 * Enfileira geração em story_jobs e dispara o worker no mesmo processo.
 * Retorna jobId imediatamente — o browser pode fechar.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const usage = await getStoryUsage();
  const mockUsed = await countMockStoriesThisMonth(user.id);
  const used = Math.max(
    usage.used,
    usage.source === "supabase" ? usage.used : mockUsed,
  );
  if (used >= usage.limit) {
    return NextResponse.json(
      {
        error: `Limite mensal atingido (${usage.limit ?? MONTHLY_STORY_LIMIT} histórias).`,
      },
      { status: 429 },
    );
  }

  const enqueued = await enqueueStoryJob({ userId: user.id, body });
  if (!enqueued.jobId) {
    return NextResponse.json(
      { error: enqueued.error || "Falha ao enfileirar." },
      { status: 500 },
    );
  }

  const jobId = enqueued.jobId;

  // Worker no mesmo processo (sobrevive ao fechar a aba do client).
  after(async () => {
    try {
      await processStoryJob(jobId);
    } catch (err) {
      console.error("[story_jobs] process failed", jobId, err);
    }
  });

  // Também dispara route auxiliar (redundância se after falhar em runtime).
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://127.0.0.1:5050";
  void fetch(`${origin}/api/stories/jobs/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    queued: true,
    jobId,
    message: "História na fila. Você pode sair — avisaremos quando ficar pronta.",
  });
}
