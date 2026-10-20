"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  isPlanSource,
  type PlanSource,
} from "@/lib/billing/plan-source";
import { resolveSubscriptionPlan } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminActionResult = {
  error?: string;
  success?: boolean;
  recoveryLink?: string;
  message?: string;
};

async function dbOrError() {
  const gate = await requireAdmin();
  if ("error" in gate) return { error: gate.error } as const;
  const admin = createAdminClient();
  if (!admin) return { error: "Admin indisponível." } as const;
  return { admin, user: gate.user } as const;
}

export type AdminStoryCostRow = {
  id: string;
  title: string;
  createdAt: string;
  coverImageUrl: string | null;
  estimatedUsd: number;
  estimatedBrl: number;
  pages: number;
};

export async function listAdminUserStoriesAction(input: {
  userId: string;
}): Promise<{ error?: string; stories?: AdminStoryCostRow[] }> {
  const ctx = await dbOrError();
  if ("error" in ctx) return { error: ctx.error };

  const { data: stories, error } = await ctx.admin
    .from("stories")
    .select("id, title, created_at, cover_image_url, generation_meta, text_content")
    .eq("parent_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { error: error.message };

  const { data: usage } = await ctx.admin
    .from("usage_events")
    .select(
      "estimated_usd, estimated_brl, created_at, meta, story_id, job_id, category",
    )
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(5000);

  const events = usage ?? [];

  // job_id → story_id via story_jobs (fallback para eventos só com job)
  const { data: jobs } = await ctx.admin
    .from("story_jobs")
    .select("id, story_id")
    .eq("parent_id", input.userId)
    .not("story_id", "is", null)
    .limit(200);
  const jobToStory = new Map<string, string>();
  for (const j of jobs ?? []) {
    if (j.story_id) jobToStory.set(j.id, j.story_id);
  }

  const byStory = new Map<string, { usd: number; brl: number }>();
  for (const ev of events) {
    const storyId =
      (ev.story_id as string | null) ||
      (ev.job_id ? jobToStory.get(String(ev.job_id)) : null) ||
      null;
    if (!storyId) continue;
    const prev = byStory.get(storyId) ?? { usd: 0, brl: 0 };
    prev.usd += Number(ev.estimated_usd) || 0;
    prev.brl += Number(ev.estimated_brl) || 0;
    byStory.set(storyId, prev);
  }

  const rows: AdminStoryCostRow[] = (stories ?? []).map((s) => {
    const linked = byStory.get(s.id);
    let usd = linked?.usd ?? 0;
    let brl = linked?.brl ?? 0;

    // Fallback legado: janela ampla (clarify → imagens longas) se ainda sem link.
    if (!linked) {
      const created = new Date(s.created_at).getTime();
      const windowStart = created - 15 * 60_000;
      const windowEnd = created + 60 * 60_000;
      for (const ev of events) {
        if (ev.story_id || ev.job_id) continue; // já contados noutro sítio
        const t = new Date(ev.created_at).getTime();
        if (t >= windowStart && t <= windowEnd) {
          usd += Number(ev.estimated_usd) || 0;
          brl += Number(ev.estimated_brl) || 0;
        }
      }
    }

    const meta = (s.generation_meta ?? {}) as {
      estimatedUsd?: number;
      estimatedBrl?: number;
      pages?: number;
    };
    // meta gravado na geração tem prioridade se maior/igual (fonte canônica pós-v30)
    if (meta.estimatedUsd != null && Number(meta.estimatedUsd) >= usd) {
      usd = Number(meta.estimatedUsd) || usd;
    }
    if (meta.estimatedBrl != null && Number(meta.estimatedBrl) >= brl) {
      brl = Number(meta.estimatedBrl) || brl;
    }
    const textPages =
      (
        s.text_content as { pages?: unknown[] } | null
      )?.pages?.length ?? meta.pages ?? 0;

    return {
      id: s.id,
      title: s.title,
      createdAt: s.created_at,
      coverImageUrl: s.cover_image_url,
      estimatedUsd: Number(usd.toFixed(6)),
      estimatedBrl: Number(brl.toFixed(6)),
      pages: textPages,
    };
  });

  return { stories: rows };
}

export async function deleteAdminStoryAction(input: {
  userId: string;
  storyId: string;
}): Promise<AdminActionResult> {
  const ctx = await dbOrError();
  if ("error" in ctx) return { error: ctx.error };

  const { data: story } = await ctx.admin
    .from("stories")
    .select("id, parent_id")
    .eq("id", input.storyId)
    .maybeSingle();

  if (!story || story.parent_id !== input.userId) {
    return { error: "História não encontrada." };
  }

  const { data: images } = await ctx.admin
    .from("story_images")
    .select("image_url")
    .eq("story_id", input.storyId);

  // Best-effort storage cleanup for avatars/stories paths
  const paths: string[] = [];
  for (const img of images ?? []) {
    const url = img.image_url || "";
    const marker = "/avatars/";
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      const path = decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
      if (path) paths.push(path);
    }
  }
  if (paths.length) {
    try {
      await ctx.admin.storage.from("avatars").remove(paths);
    } catch {
      /* ignore */
    }
  }

  await ctx.admin.from("story_images").delete().eq("story_id", input.storyId);
  await ctx.admin.from("games").delete().eq("story_id", input.storyId);
  const { error } = await ctx.admin
    .from("stories")
    .delete()
    .eq("id", input.storyId)
    .eq("parent_id", input.userId);

  if (error) return { error: error.message };
  revalidatePath("/app/admin");
  return { success: true, message: "História apagada." };
}

export async function updateSubscriptionAction(input: {
  userId: string;
  subscriptionStatus: string;
  subscriptionPlanId: string;
  planSource?: PlanSource;
}): Promise<AdminActionResult> {
  const ctx = await dbOrError();
  if ("error" in ctx) return { error: ctx.error };

  const allowedStatus = [
    "trialing",
    "active",
    "past_due",
    "canceled",
    "incomplete",
    "none",
  ];
  if (!allowedStatus.includes(input.subscriptionStatus)) {
    return { error: "Status de assinatura inválido." };
  }

  const planId = (input.subscriptionPlanId || "").trim();
  if (planId && !resolveSubscriptionPlan(planId)) {
    return { error: "Plano inválido (use starter, family, plus ou vazio)." };
  }

  const planSource: PlanSource = isPlanSource(input.planSource)
    ? input.planSource
    : planId
      ? "gift"
      : "none";

  const patch: Record<string, unknown> = {
    subscription_status: input.subscriptionStatus,
    subscription_plan_id: planId || null,
    plan_source: planSource,
  };

  // Presente: ativo sem cobrança até o Admin alterar.
  if (planSource === "gift" && planId) {
    patch.subscription_status = "active";
  }
  if (planSource === "none" || !planId) {
    patch.subscription_status = "none";
    patch.subscription_plan_id = null;
    patch.plan_source = "none";
  }

  const { error } = await ctx.admin
    .from("users")
    .update(patch)
    .eq("id", input.userId);

  if (error) return { error: error.message };
  revalidatePath("/app/admin");
  return { success: true, message: "Tipo e plano atualizados." };
}

/** Habilita Presente (Admin): plano + plan_source=gift + active. */
export async function enableGiftPlanAction(input: {
  userId: string;
  planId: string;
}): Promise<AdminActionResult> {
  return updateSubscriptionAction({
    userId: input.userId,
    subscriptionPlanId: input.planId,
    subscriptionStatus: "active",
    planSource: "gift",
  });
}

export async function addExtraCreditsAction(input: {
  userId: string;
  stories?: number;
  avatars?: number;
}): Promise<AdminActionResult> {
  const ctx = await dbOrError();
  if ("error" in ctx) return { error: ctx.error };

  const addStories = Math.floor(input.stories ?? 0);
  const addAvatars = Math.floor(input.avatars ?? 0);
  if (
    (!Number.isFinite(addStories) || addStories < 0) ||
    (!Number.isFinite(addAvatars) || addAvatars < 0)
  ) {
    return { error: "Quantidades inválidas." };
  }
  if (addStories === 0 && addAvatars === 0) {
    return { error: "Informe +histórias e/ou +avatares (> 0)." };
  }
  if (addStories > 100 || addAvatars > 100) {
    return { error: "Máximo +100 por vez." };
  }

  const { data: profile } = await ctx.admin
    .from("users")
    .select("extra_stories_available, extra_characters_available")
    .eq("id", input.userId)
    .maybeSingle();

  if (!profile) return { error: "Usuário não encontrado." };

  const prevStories =
    typeof profile.extra_stories_available === "number"
      ? profile.extra_stories_available
      : 0;
  const prevAvatars =
    typeof profile.extra_characters_available === "number"
      ? profile.extra_characters_available
      : 0;

  const { error } = await ctx.admin
    .from("users")
    .update({
      extra_stories_available: prevStories + addStories,
      extra_characters_available: prevAvatars + addAvatars,
    })
    .eq("id", input.userId);

  if (error) return { error: error.message };
  revalidatePath("/app/admin");
  const parts: string[] = [];
  if (addStories) parts.push(`+${addStories} história(s)`);
  if (addAvatars) parts.push(`+${addAvatars} avatar(es)`);
  return { success: true, message: `Créditos: ${parts.join(" · ")}.` };
}

/** @deprecated UI removida — mantido por compat. */
export async function addComplimentaryDaysAction(input: {
  userId: string;
  days: number;
}): Promise<AdminActionResult> {
  const ctx = await dbOrError();
  if ("error" in ctx) return { error: ctx.error };

  const days = Math.floor(input.days);
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return { error: "Informe entre 1 e 365 dias." };
  }

  const { data: profile } = await ctx.admin
    .from("users")
    .select("complimentary_until")
    .eq("id", input.userId)
    .maybeSingle();

  const now = new Date();
  const current = profile?.complimentary_until
    ? new Date(profile.complimentary_until)
    : null;
  const base =
    current && current.getTime() > now.getTime() ? current : now;
  const next = new Date(base);
  next.setDate(next.getDate() + days);

  const { error } = await ctx.admin
    .from("users")
    .update({ complimentary_until: next.toISOString() })
    .eq("id", input.userId);

  if (error) return { error: error.message };
  revalidatePath("/app/admin");
  return {
    success: true,
    message: `Dias grátis até ${next.toLocaleDateString("pt-BR")}.`,
  };
}

export async function generateRecoveryLinkAction(input: {
  userId: string;
  email: string;
}): Promise<AdminActionResult> {
  const ctx = await dbOrError();
  if ("error" in ctx) return { error: ctx.error };

  const origin =
    process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:5050";

  const { data, error } = await ctx.admin.auth.admin.generateLink({
    type: "recovery",
    email: input.email,
    options: {
      redirectTo: `${origin}/login`,
    },
  });

  if (error) return { error: error.message };

  const link =
    data.properties?.action_link ||
    (data as { action_link?: string }).action_link ||
    null;

  if (!link) return { error: "Link de recovery não retornado." };
  return { success: true, recoveryLink: link };
}

export async function saveAdminNotesAction(input: {
  userId: string;
  notes: string;
}): Promise<AdminActionResult> {
  const ctx = await dbOrError();
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await ctx.admin
    .from("users")
    .update({ admin_notes: input.notes.slice(0, 4000) || null })
    .eq("id", input.userId);

  if (error) return { error: error.message };
  revalidatePath("/app/admin");
  return { success: true, message: "Notas salvas." };
}

async function wipeAvatarStorage(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
) {
  try {
    for (const folder of ["child", "friend", ""]) {
      const prefix = folder ? `${userId}/${folder}` : userId;
      const { data: listed } = await admin.storage.from("avatars").list(prefix, {
        limit: 100,
      });
      if (!listed?.length) continue;
      const paths = listed
        .filter((f) => f.name)
        .map((f) => (folder ? `${prefix}/${f.name}` : `${userId}/${f.name}`));
      if (paths.length) {
        await admin.storage.from("avatars").remove(paths);
      }
      // nested subject folders
      if (!folder) {
        for (const item of listed) {
          if (item.id === null || item.metadata == null) {
            const { data: nested } = await admin.storage
              .from("avatars")
              .list(`${userId}/${item.name}`, { limit: 100 });
            const nestedPaths =
              nested?.map((n) => `${userId}/${item.name}/${n.name}`) ?? [];
            if (nestedPaths.length) {
              await admin.storage.from("avatars").remove(nestedPaths);
            }
          }
        }
      }
    }
  } catch {
    // best-effort
  }
}

export async function resetOnboardingAction(input: {
  userId: string;
  mode: "full" | "reuse";
}): Promise<AdminActionResult> {
  const ctx = await dbOrError();
  if ("error" in ctx) return { error: ctx.error };

  if (input.mode !== "full" && input.mode !== "reuse") {
    return { error: "Modo inválido." };
  }

  // Never wipe admin accounts accidentally by role check
  const { data: target } = await ctx.admin
    .from("users")
    .select("id, role, email")
    .eq("id", input.userId)
    .maybeSingle();

  if (!target) return { error: "Usuário não encontrado." };
  if (target.role === "admin") {
    return { error: "Não reiniciar onboarding de contas admin." };
  }

  if (input.mode === "full") {
    await ctx.admin.from("games").delete().eq("parent_id", input.userId);
    await ctx.admin.from("story_images").delete().eq("parent_id", input.userId);
    await ctx.admin.from("stories").delete().eq("parent_id", input.userId);
    await ctx.admin.from("characters").delete().eq("parent_id", input.userId);
    await ctx.admin.from("children").delete().eq("parent_id", input.userId);
    await wipeAvatarStorage(ctx.admin, input.userId);
  }

  const { error } = await ctx.admin
    .from("users")
    .update({
      onboarding_completed: false,
      onboarding_reset_mode: input.mode,
    })
    .eq("id", input.userId);

  if (error) return { error: error.message };
  revalidatePath("/app/admin");
  revalidatePath("/onboarding");
  return {
    success: true,
    message:
      input.mode === "full"
        ? "Onboarding reiniciado do zero (materiais apagados)."
        : "Onboarding reiniciado reutilizando materiais.",
  };
}
