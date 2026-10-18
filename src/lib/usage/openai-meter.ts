import { createAdminClient } from "@/lib/supabase/admin";
import { getUsageContext } from "@/lib/usage/usage-context";

export type UsageCategory =
  | "avatar_pixar"
  | "story_text"
  | "story_image"
  | "story_quiz"
  | "story_clarify"
  | "other";

export type ChatUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

/** Preços aproximados USD por 1M tokens (input/output) ou por imagem. */
const CHAT_PRICES: Record<string, { inPerM: number; outPerM: number }> = {
  "gpt-4o": { inPerM: 2.5, outPerM: 10 },
  "gpt-4o-mini": { inPerM: 0.15, outPerM: 0.6 },
  "gpt-4.1": { inPerM: 2, outPerM: 8 },
};

/** Custo base por imagem (antes do multiplicador de quality). */
const IMAGE_USD: Record<string, number> = {
  "gpt-image-2": 0.04,
  "gpt-image-1": 0.04,
  "dall-e-3": 0.04,
};

function usdBrlRate(): number {
  const raw = process.env.USD_BRL_RATE?.trim();
  const n = raw ? Number(raw) : 5.7;
  return Number.isFinite(n) && n > 0 ? n : 5.7;
}

export function estimateChatUsd(
  model: string,
  usage: ChatUsage | null | undefined,
): { prompt: number; completion: number; total: number; usd: number } {
  const prompt = usage?.prompt_tokens ?? 0;
  const completion = usage?.completion_tokens ?? 0;
  const total = usage?.total_tokens ?? prompt + completion;
  const key = Object.keys(CHAT_PRICES).find((k) => model.includes(k)) ?? "gpt-4o";
  const price = CHAT_PRICES[key];
  const usd =
    (prompt / 1_000_000) * price.inPerM +
    (completion / 1_000_000) * price.outPerM;
  return { prompt, completion, total, usd };
}

export function estimateImageUsd(model: string, images = 1): number {
  const key =
    Object.keys(IMAGE_USD).find((k) => model.includes(k)) ?? "gpt-image-2";
  return (IMAGE_USD[key] ?? 0.04) * images;
}

export async function recordUsageEvent(input: {
  userId: string | null | undefined;
  category: UsageCategory;
  model?: string;
  operation?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedUsd?: number;
  meta?: Record<string, unknown>;
  storyId?: string | null;
  jobId?: string | null;
}): Promise<void> {
  if (!input.userId) return;
  const ctx = getUsageContext();
  const storyId = input.storyId ?? ctx.storyId ?? null;
  const jobId = input.jobId ?? ctx.jobId ?? null;
  const generationKey = ctx.generationKey ?? null;
  const usd = Math.max(0, input.estimatedUsd ?? 0);
  const brl = usd * usdBrlRate();
  const admin = createAdminClient();
  if (!admin) return;
  try {
    await admin.from("usage_events").insert({
      user_id: input.userId,
      category: input.category,
      provider: "openai",
      model: input.model ?? null,
      operation: input.operation ?? null,
      prompt_tokens: input.promptTokens ?? 0,
      completion_tokens: input.completionTokens ?? 0,
      total_tokens:
        input.totalTokens ??
        (input.promptTokens ?? 0) + (input.completionTokens ?? 0),
      estimated_usd: Number(usd.toFixed(6)),
      estimated_brl: Number(brl.toFixed(6)),
      story_id: storyId,
      job_id: jobId,
      meta: {
        ...(input.meta ?? {}),
        ...(generationKey ? { generationKey } : {}),
      },
    });
  } catch {
    /* não bloquear geração se medição falhar */
  }
}

/** Associa clarify recente (antes do enqueue) ao job. */
export async function attachRecentClarifyToJob(input: {
  userId: string;
  jobId: string;
  lookbackMs?: number;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const since = new Date(
    Date.now() - (input.lookbackMs ?? 10 * 60_000),
  ).toISOString();
  try {
    await admin
      .from("usage_events")
      .update({ job_id: input.jobId })
      .eq("user_id", input.userId)
      .eq("category", "story_clarify")
      .is("job_id", null)
      .gte("created_at", since);
  } catch {
    /* ignore */
  }
}

/** Após persistir a história: marca todos os eventos do job com story_id. */
export async function attachUsageToStory(input: {
  userId: string;
  storyId: string;
  jobId?: string | null;
  generationKey?: string | null;
}): Promise<{ usd: number; brl: number }> {
  const admin = createAdminClient();
  if (!admin) return { usd: 0, brl: 0 };
  try {
    if (input.jobId) {
      await admin
        .from("usage_events")
        .update({ story_id: input.storyId })
        .eq("user_id", input.userId)
        .eq("job_id", input.jobId);
    }
    if (input.generationKey) {
      const patch: { story_id: string; job_id?: string } = {
        story_id: input.storyId,
      };
      if (input.jobId) patch.job_id = input.jobId;
      await admin
        .from("usage_events")
        .update(patch)
        .eq("user_id", input.userId)
        .contains("meta", { generationKey: input.generationKey });
    }

    const filter = input.jobId
      ? `story_id.eq.${input.storyId},job_id.eq.${input.jobId}`
      : `story_id.eq.${input.storyId}`;
    const { data } = await admin
      .from("usage_events")
      .select("estimated_usd, estimated_brl")
      .eq("user_id", input.userId)
      .or(filter);

    let usd = 0;
    let brl = 0;
    for (const row of data ?? []) {
      usd += Number(row.estimated_usd) || 0;
      brl += Number(row.estimated_brl) || 0;
    }
    return { usd: Number(usd.toFixed(6)), brl: Number(brl.toFixed(6)) };
  } catch {
    return { usd: 0, brl: 0 };
  }
}

export async function sumUsageForStory(input: {
  userId: string;
  storyId: string;
}): Promise<{ usd: number; brl: number }> {
  const admin = createAdminClient();
  if (!admin) return { usd: 0, brl: 0 };
  try {
    const { data } = await admin
      .from("usage_events")
      .select("estimated_usd, estimated_brl")
      .eq("user_id", input.userId)
      .eq("story_id", input.storyId);
    let usd = 0;
    let brl = 0;
    for (const row of data ?? []) {
      usd += Number(row.estimated_usd) || 0;
      brl += Number(row.estimated_brl) || 0;
    }
    return { usd: Number(usd.toFixed(6)), brl: Number(brl.toFixed(6)) };
  } catch {
    return { usd: 0, brl: 0 };
  }
}

export async function meteredChatCompletion(input: {
  userId?: string | null;
  category: UsageCategory;
  operation: string;
  body: Record<string, unknown>;
  timeoutMs?: number;
  storyId?: string | null;
  jobId?: string | null;
}): Promise<{
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
  content: string | null;
  error?: string;
}> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return {
      ok: false,
      status: 0,
      json: { error: "no key" },
      content: null,
      error: "OPENAI_API_KEY ausente",
    };
  }
  const model = String(input.body.model ?? "gpt-4o");
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.body),
      signal: AbortSignal.timeout(input.timeoutMs ?? 180_000),
    });
    let json: Record<string, unknown> = {};
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        status: res.status,
        json: {},
        content: null,
        error: `OpenAI respondeu sem JSON (${res.status})`,
      };
    }
    const usage = json.usage as ChatUsage | undefined;
    const est = estimateChatUsd(model, usage);
    await recordUsageEvent({
      userId: input.userId,
      category: input.category,
      model,
      operation: input.operation,
      promptTokens: est.prompt,
      completionTokens: est.completion,
      totalTokens: est.total,
      estimatedUsd: est.usd,
      storyId: input.storyId,
      jobId: input.jobId,
    });
    const content =
      (
        json.choices as { message?: { content?: string } }[] | undefined
      )?.[0]?.message?.content ?? null;
    const apiErr =
      typeof (json.error as { message?: string } | undefined)?.message ===
      "string"
        ? (json.error as { message: string }).message
        : undefined;
    if (!res.ok) {
      console.error(
        `[openai] ${input.operation} ${model} HTTP ${res.status}`,
        apiErr ?? json,
      );
    }
    return {
      ok: res.ok,
      status: res.status,
      json,
      content,
      error: res.ok ? undefined : apiErr || `OpenAI HTTP ${res.status}`,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha de rede na OpenAI";
    console.error(`[openai] ${input.operation} ${model} throw`, message);
    return {
      ok: false,
      status: 0,
      json: { error: message },
      content: null,
      error: message,
    };
  }
}
