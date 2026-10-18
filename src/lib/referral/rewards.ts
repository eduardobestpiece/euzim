import { createAdminClient } from "@/lib/supabase/admin";
import {
  giftOptionsForPlan,
  type GiftOption,
  type GiftOptionId,
} from "@/lib/referral/constants";

export type ReferralRewardRow = {
  id: string;
  referrer_id: string;
  referee_id: string;
  plan_id: string;
  status: "pending_choice" | "claimed" | "void";
  options: GiftOption[];
  chosen: GiftOption | null;
  created_at: string;
};

/**
 * Após 1ª assinatura paga do indicado: cria reward pending_choice
 * para o indicador (idempotente por referee_id).
 */
export async function grantReferralRewardOnFirstSubscription(input: {
  refereeId: string;
  planId: string;
}): Promise<{ ok: boolean; created?: boolean; error?: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Admin indisponível." };

  const options = giftOptionsForPlan(input.planId);
  if (options.length === 0) {
    return { ok: false, error: "Plano sem opções de presente." };
  }

  const { data: referee } = await admin
    .from("users")
    .select("id, referred_by, referral_rewarded_at, full_name, email")
    .eq("id", input.refereeId)
    .maybeSingle();

  if (!referee) return { ok: false, error: "Indicado não encontrado." };
  if (!referee.referred_by) {
    return { ok: true, created: false };
  }
  if (referee.referral_rewarded_at) {
    return { ok: true, created: false };
  }

  const referrerId = referee.referred_by as string;

  const { data: existing } = await admin
    .from("referral_rewards")
    .select("id")
    .eq("referee_id", input.refereeId)
    .maybeSingle();

  if (existing) {
    // Já existe — marca rewarded se ainda não
    await admin
      .from("users")
      .update({ referral_rewarded_at: new Date().toISOString() })
      .eq("id", input.refereeId)
      .is("referral_rewarded_at", null);
    return { ok: true, created: false };
  }

  const { data: reward, error: insertError } = await admin
    .from("referral_rewards")
    .insert({
      referrer_id: referrerId,
      referee_id: input.refereeId,
      plan_id: input.planId,
      status: "pending_choice",
      options,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    // Unique race — treat as ok
    if (insertError.message.toLowerCase().includes("unique")) {
      return { ok: true, created: false };
    }
    return { ok: false, error: insertError.message };
  }

  await admin
    .from("users")
    .update({ referral_rewarded_at: new Date().toISOString() })
    .eq("id", input.refereeId);

  const refereeLabel =
    (typeof referee.full_name === "string" && referee.full_name.trim()) ||
    (typeof referee.email === "string" ? referee.email.split("@")[0] : null) ||
    "alguém";

  await admin.from("notifications").insert({
    user_id: referrerId,
    kind: "referral_gift_pending",
    title: "Você ganhou um presente!",
    body: `${refereeLabel} assinou pelo seu link. Escolha seu presente.`,
    href: "/app/parent/gifts",
    payload: { reward_id: reward?.id, referee_id: input.refereeId },
  });

  return { ok: true, created: true };
}

export async function listPendingRewardsForUser(
  referrerId: string,
): Promise<ReferralRewardRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("referral_rewards")
    .select("id, referrer_id, referee_id, plan_id, status, options, chosen, created_at")
    .eq("referrer_id", referrerId)
    .eq("status", "pending_choice")
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    referrer_id: row.referrer_id as string,
    referee_id: row.referee_id as string,
    plan_id: row.plan_id as string,
    status: row.status as ReferralRewardRow["status"],
    options: Array.isArray(row.options) ? (row.options as GiftOption[]) : [],
    chosen: (row.chosen as GiftOption | null) ?? null,
    created_at: row.created_at as string,
  }));
}

export async function claimReferralReward(input: {
  referrerId: string;
  rewardId: string;
  optionId: GiftOptionId;
}): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Admin indisponível." };

  const { data: reward } = await admin
    .from("referral_rewards")
    .select("id, referrer_id, plan_id, status, options")
    .eq("id", input.rewardId)
    .maybeSingle();

  if (!reward) return { ok: false, error: "Presente não encontrado." };
  if (reward.referrer_id !== input.referrerId) {
    return { ok: false, error: "Este presente não é seu." };
  }
  if (reward.status !== "pending_choice") {
    return { ok: false, error: "Este presente já foi escolhido." };
  }

  const options = Array.isArray(reward.options)
    ? (reward.options as GiftOption[])
    : giftOptionsForPlan(String(reward.plan_id));
  const chosen = options.find((o) => o.id === input.optionId);
  if (!chosen) return { ok: false, error: "Opção inválida." };

  const { data: profile } = await admin
    .from("users")
    .select("extra_stories_available, extra_characters_available")
    .eq("id", input.referrerId)
    .maybeSingle();

  const prevStories =
    typeof profile?.extra_stories_available === "number"
      ? profile.extra_stories_available
      : 0;
  const prevAvatars =
    typeof profile?.extra_characters_available === "number"
      ? profile.extra_characters_available
      : 0;

  const { error: creditError } = await admin
    .from("users")
    .update({
      extra_stories_available: prevStories + chosen.stories,
      extra_characters_available: prevAvatars + chosen.avatars,
    })
    .eq("id", input.referrerId);

  if (creditError) return { ok: false, error: creditError.message };

  const { error: claimError } = await admin
    .from("referral_rewards")
    .update({
      status: "claimed",
      chosen,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", input.rewardId)
    .eq("status", "pending_choice");

  if (claimError) return { ok: false, error: claimError.message };

  await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", input.referrerId)
    .eq("kind", "referral_gift_pending")
    .is("read_at", null);

  return { ok: true };
}
