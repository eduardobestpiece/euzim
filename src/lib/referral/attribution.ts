"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { findUserIdByReferralCode } from "@/lib/referral/codes";
import {
  REFERRAL_CHANNEL_COOKIE,
  REFERRAL_COOKIE,
  parseReferralChannel,
  normalizeReferralCode,
} from "@/lib/referral/cookie";

/**
 * Lê cookie euzim_ref e vincula referred_by se o usuário ainda não
 * teve 1ª assinatura recompensada (último clique).
 */
export async function applyReferralAttribution(
  userId: string,
): Promise<{ applied: boolean; referrerId?: string; reason?: string }> {
  const jar = await cookies();
  const code = normalizeReferralCode(jar.get(REFERRAL_COOKIE)?.value);
  if (!code) return { applied: false, reason: "no_cookie" };

  const referrerId = await findUserIdByReferralCode(code);
  if (!referrerId) return { applied: false, reason: "unknown_code" };
  if (referrerId === userId) {
    return { applied: false, reason: "self" };
  }

  const db = createAdminClient() ?? (await createClient());
  if (!db) return { applied: false, reason: "db" };

  const { data: profile } = await db
    .from("users")
    .select("referred_by, referral_rewarded_at, subscription_status")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return { applied: false, reason: "no_profile" };

  // Já gerou recompensa de 1ª assinatura → não sobrescreve
  if (profile.referral_rewarded_at) {
    return { applied: false, reason: "already_rewarded" };
  }

  // Assinante ativo antigo (já pagou) sem flag — não sobrescreve attribution
  if (
    profile.subscription_status === "active" &&
    profile.referred_by &&
    profile.referred_by !== referrerId
  ) {
    return { applied: false, reason: "active_subscriber" };
  }

  const { error } = await db
    .from("users")
    .update({ referred_by: referrerId })
    .eq("id", userId);

  if (error) return { applied: false, reason: error.message };

  // Audit opcional
  const channel = parseReferralChannel(jar.get(REFERRAL_CHANNEL_COOKIE)?.value);
  await db.from("referral_clicks").insert({
    code,
    channel,
    meta: { user_id: userId, event: "attribution" },
  });

  return { applied: true, referrerId };
}
