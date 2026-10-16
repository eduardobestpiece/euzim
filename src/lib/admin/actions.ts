"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
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
  if (!admin) return { error: "Admin Supabase indisponível." } as const;
  return { admin, user: gate.user } as const;
}

export async function updateSubscriptionAction(input: {
  userId: string;
  subscriptionStatus: string;
  subscriptionPlanId: string;
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

  const { error } = await ctx.admin
    .from("users")
    .update({
      subscription_status: input.subscriptionStatus,
      subscription_plan_id: input.subscriptionPlanId || null,
    })
    .eq("id", input.userId);

  if (error) return { error: error.message };
  revalidatePath("/app/admin");
  return { success: true, message: "Plano/status atualizados." };
}

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
