import { createAdminClient } from "@/lib/supabase/admin";
import { FAMILY_SUBSCRIPTION } from "@/lib/billing/plans";
import { resolveCharacterPack } from "@/lib/billing/plans";

export type FulfillmentResult = {
  ok: boolean;
  error?: string;
  mock?: boolean;
};

/** Ativa assinatura Família no perfil Supabase. */
export async function fulfillSubscription(userId: string): Promise<FulfillmentResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Admin Supabase indisponível." };

  const { error } = await admin
    .from("users")
    .update({
      subscription_status: "active",
      subscription_plan_id: FAMILY_SUBSCRIPTION.planId,
    })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  // Garante limites family alinhados ao brief (15 histórias)
  await admin.from("subscription_limits").upsert(
    {
      plan_id: FAMILY_SUBSCRIPTION.planId,
      plan_name: "Família",
      max_children: 4,
      max_stories_per_month: FAMILY_SUBSCRIPTION.storiesPerMonth,
      max_characters: FAMILY_SUBSCRIPTION.includedCharacters,
      max_images_per_story: 8,
      features: { share: true, lora: true, stripe: true },
      is_active: true,
    },
    { onConflict: "plan_id" },
  );

  return { ok: true };
}

/** Soma personagens extras comprados (coluna ou metadata). */
export async function fulfillCharacterPack(
  userId: string,
  packId: string,
): Promise<FulfillmentResult> {
  const pack = resolveCharacterPack(packId);
  if (!pack) return { ok: false, error: "Pacote inválido." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Admin Supabase indisponível." };

  const { data: profile } = await admin
    .from("users")
    .select("id, subscription_plan_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return { ok: false, error: "Usuário não encontrado." };

  // Preferência: coluna extra_characters_available se existir; senão features via RPC-free update raw
  const { data: current } = await admin
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const prev =
    typeof (current as { extra_characters_available?: number } | null)
      ?.extra_characters_available === "number"
      ? (current as { extra_characters_available: number }).extra_characters_available
      : 0;

  const next = prev + pack.characters;

  const { error } = await admin
    .from("users")
    .update({
      extra_characters_available: next,
      subscription_plan_id: profile.subscription_plan_id || FAMILY_SUBSCRIPTION.planId,
    } as Record<string, unknown>)
    .eq("id", userId);

  if (error) {
    // Coluna pode não existir ainda — registra em subscription_limits features fallback
    if (error.message.includes("extra_characters_available")) {
      await admin.from("subscription_limits").upsert(
        {
          plan_id: `extras:${userId}`,
          plan_name: `Extras ${userId.slice(0, 8)}`,
          max_children: 1,
          max_stories_per_month: FAMILY_SUBSCRIPTION.storiesPerMonth,
          max_characters: FAMILY_SUBSCRIPTION.includedCharacters + next,
          max_images_per_story: 8,
          features: {
            user_id: userId,
            extra_characters_available: next,
            last_pack_id: packId,
          },
          is_active: true,
        },
        { onConflict: "plan_id" },
      );
      return { ok: true, mock: true };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** Simulação local quando Stripe secret/webhook não estão prontos. */
export async function mockFulfillCheckout(input: {
  userId: string;
  kind: "subscription" | "character_pack";
  packId?: string;
}): Promise<FulfillmentResult> {
  if (input.kind === "subscription") {
    const result = await fulfillSubscription(input.userId);
    return { ...result, mock: true };
  }
  if (!input.packId) return { ok: false, error: "packId obrigatório." };
  const result = await fulfillCharacterPack(input.userId, input.packId);
  return { ...result, mock: true };
}
