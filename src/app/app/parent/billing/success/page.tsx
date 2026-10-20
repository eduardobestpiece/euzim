import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppPageFallback } from "@/components/app/app-page-fallback";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getStripe } from "@/lib/stripe/client";
import {
  fulfillCharacterPack,
  fulfillExtraStory,
  fulfillSubscription,
} from "@/lib/stripe/fulfillment";
import { subscriptionPeriodEndIso } from "@/lib/stripe/subscription-period";
import { grantReferralRewardOnFirstSubscription } from "@/lib/referral/rewards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SuccessParams = {
  session_id?: string;
  kind?: string;
  pack_id?: string;
  plan_id?: string;
  count?: string;
  resume_onboarding?: string;
  wizard_step?: string;
};

async function BillingSuccessPageInner({
  searchParams,
}: {
  searchParams: Promise<SuccessParams>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;
  let note =
    "Pagamento recebido. Se o webhook estiver configurado, o plano já foi atualizado.";
  let activatedPlanId: string | null = null;

  const stripe = getStripe();
  if (stripe && params.session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(params.session_id);
      const userId =
        session.metadata?.supabase_user_id ||
        session.client_reference_id ||
        user.id;
      const kind = params.kind || session.metadata?.kind || "";
      const paid =
        session.payment_status === "paid" || session.status === "complete";

      if (paid && userId) {
        if (kind === "character_pack") {
          const packId = params.pack_id || session.metadata?.pack_id;
          if (packId) {
            const result = await fulfillCharacterPack(userId, packId);
            note = result.ok
              ? "Pacote de personagens creditado."
              : `Pagamento ok, mas crédito falhou: ${result.error}`;
          }
        } else if (kind === "custom_avatars") {
          const count = Number.parseInt(
            params.count || session.metadata?.characters || "0",
            10,
          );
          const result = await fulfillCharacterPack(userId, "custom", count);
          note = result.ok
            ? `${count} avatares creditados.`
            : `Pagamento ok, mas crédito falhou: ${result.error}`;
        } else if (kind === "extra_story") {
          const result = await fulfillExtraStory(userId);
          note = result.ok
            ? "História adicional creditada."
            : `Pagamento ok, mas crédito falhou: ${result.error}`;
        } else {
          const planId =
            params.plan_id || session.metadata?.plan_id || "family";
          let stripeSubscriptionId: string | null = null;
          let stripeCurrentPeriodEnd: string | null = null;
          const subRef = session.subscription;
          const subId =
            typeof subRef === "string" ? subRef : subRef?.id ?? null;
          if (subId) {
            stripeSubscriptionId = subId;
            try {
              const sub = await stripe.subscriptions.retrieve(subId);
              stripeCurrentPeriodEnd = subscriptionPeriodEndIso(sub);
            } catch {
              /* best-effort */
            }
          }
          const result = await fulfillSubscription(userId, planId, {
            stripeSubscriptionId,
            stripeCurrentPeriodEnd,
          });
          activatedPlanId = planId;
          if (result.ok) {
            await grantReferralRewardOnFirstSubscription({
              refereeId: userId,
              planId,
            });
          }
          note = result.ok
            ? `Assinatura (${planId}) ativada.`
            : `Pagamento ok, mas ativação falhou: ${result.error}`;
        }
      }
    } catch {
      note =
        "Sessão Stripe não recuperável ainda — o webhook completará quando STRIPE_WEBHOOK_SECRET estiver ativo.";
    }
  }

  const resume =
    params.resume_onboarding === "1" ||
    params.wizard_step === "generating";

  if (resume && !user.onboardingCompleted) {
    // Persiste passo generating para o wizard retomar com fotos
    const db = createAdminClient() ?? (await createClient());
    if (db) {
      const { data: children } = await db
        .from("children")
        .select("id, preferences")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      const child = children?.[0];
      if (child?.id) {
        const prefs =
          child.preferences && typeof child.preferences === "object"
            ? { ...(child.preferences as Record<string, unknown>) }
            : {};
        prefs.onboarding_wizard_step = "generating";
        await db
          .from("children")
          .update({ preferences: prefs })
          .eq("id", child.id);
      }
    }
    redirect("/onboarding?resume=1&paid=1");
  }

  return (
    <AppShell user={user} title="Pagamento">
      <div className="space-y-4">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Obrigado!
        </h1>
        <p className="max-w-xl text-muted-foreground">{note}</p>
        {activatedPlanId ? (
          <p className="text-sm text-muted-foreground">
            Plano ativo: {activatedPlanId}.
          </p>
        ) : null}
        <Button asChild>
          <Link href="/app/parent/settings">Ir ao perfil / assinatura</Link>
        </Button>
      </div>
    </AppShell>
  );
}

export default function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SuccessParams>;
}) {
  return (
    <Suspense fallback={<AppPageFallback />}>
      <BillingSuccessPageInner searchParams={searchParams} />
    </Suspense>
  );
}
