import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getStripe } from "@/lib/stripe/client";
import {
  fulfillCharacterPack,
  fulfillSubscription,
} from "@/lib/stripe/fulfillment";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    kind?: string;
    pack_id?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;
  let note = "Pagamento recebido. Se o webhook estiver configurado, o plano já foi atualizado.";

  const stripe = getStripe();
  if (stripe && params.session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(params.session_id);
      const userId =
        session.metadata?.supabase_user_id ||
        session.client_reference_id ||
        user.id;
      if (session.payment_status === "paid" || session.status === "complete") {
        if (params.kind === "character_pack" || session.metadata?.kind === "character_pack") {
          const packId = params.pack_id || session.metadata?.pack_id;
          if (packId) {
            const result = await fulfillCharacterPack(userId, packId);
            note = result.ok
              ? "Pacote de personagens creditado."
              : `Pagamento ok, mas crédito falhou: ${result.error}`;
          }
        } else {
          const result = await fulfillSubscription(userId);
          note = result.ok
            ? "Assinatura Família ativada."
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
          <Link href="/app/parent">Voltar ao painel</Link>
        </Button>
      </div>
    </AppShell>
  );
}
