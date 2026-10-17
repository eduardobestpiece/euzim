import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { AppPageFallback } from "@/components/app/app-page-fallback";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/get-user";

async function BillingCancelPageInner() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <AppShell user={user} title="Pagamento">
      <div className="space-y-4">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Checkout cancelado
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Nenhuma cobrança foi feita. Você pode tentar de novo quando quiser.
        </p>
        <Button asChild>
          <Link href="/app/parent">Voltar ao painel</Link>
        </Button>
      </div>
    </AppShell>
  );
}

export default function BillingCancelPage() {
  return (
    <Suspense fallback={<AppPageFallback />}>
      <BillingCancelPageInner />
    </Suspense>
  );
}
