import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
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

type SuccessParams = {
  session_id?: string;
  kind?: string;
  pack_id?: string;
  plan_id?: string;
  count?: string;
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
          const result = await fulfillSubscription(userId, planId);
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

  return (
    <AppShell user={user} title="Pagamento">
      <div className="space-y-4">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Obrigado!
        </h1>
        <p className="max-w-xl text-muted-foreground">{note}</p>
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
