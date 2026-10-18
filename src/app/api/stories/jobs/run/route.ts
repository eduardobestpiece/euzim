import { NextResponse } from "next/server";
import { processStoryJob } from "@/lib/stories/story-jobs";

export const maxDuration = 300;

/** Worker interno: processa um jobId enfileirado. */
export async function POST(request: Request) {
  let jobId = "";
  try {
    const body = (await request.json()) as { jobId?: string };
    jobId = String(body.jobId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!jobId) {
    return NextResponse.json({ error: "jobId obrigatório." }, { status: 400 });
  }

  try {
    const result = await processStoryJob(jobId);
    // Falha de negócio (job failed) → 200 para o poller/UI; 500 só em erro inesperado.
    if (!result.ok && result.status === "failed") {
      return NextResponse.json({
        ok: false,
        error: result.error,
        status: "failed",
      });
    }
    if (!result.ok && result.status !== "running") {
      return NextResponse.json(
        { ok: false, error: result.error, status: result.status },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, status: result.status });
  } catch (err) {
    console.error("[story_jobs/run] crash", jobId, err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Worker crash",
        status: "error",
      },
      { status: 500 },
    );
  }
}
