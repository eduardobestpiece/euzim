import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getStoryJobForUser } from "@/lib/stories/story-jobs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }

  const { id } = await context.params;
  const job = await getStoryJobForUser(id, user.id);
  if (!job) {
    return NextResponse.json({ error: "Job não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    theme: job.theme,
    storyId: job.story_id,
    error: job.error,
    progress: job.progress,
    createdAt: job.created_at,
    finishedAt: job.finished_at ?? null,
    redirectTo: job.story_id
      ? `/app/parent/stories/${job.story_id}`
      : null,
  });
}
