import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AppPageFallback } from "@/components/app/app-page-fallback";
import { AppShell } from "@/components/app/app-shell";
import { PendingGiftsBanner } from "@/components/referral/pending-gifts-banner";
import { ShareAppButton } from "@/components/referral/share-app-button";
import { getCurrentUser } from "@/lib/auth/get-user";
import { ensureReferralCode } from "@/lib/referral/codes";

async function GiftsInner() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const code = await ensureReferralCode(user.id);

  return (
    <AppShell user={user} title="Presentes">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Presentes por indicação
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Quando alguém assinar pela primeira vez com o seu link, você escolhe
            histórias ou avatares extras. Renovações não geram novo presente.
          </p>
        </div>

        <PendingGiftsBanner />

        <section className="space-y-3 rounded-2xl border border-border/60 p-4">
          <h2 className="font-heading text-lg font-semibold">Seu link</h2>
          <p className="text-sm text-muted-foreground">
            Código:{" "}
            <span className="font-mono font-semibold text-foreground">
              {code ?? "—"}
            </span>
          </p>
          <ShareAppButton />
        </section>
      </div>
    </AppShell>
  );
}

export default function GiftsPage() {
  return (
    <Suspense fallback={<AppPageFallback label="Carregando presentes…" />}>
      <GiftsInner />
    </Suspense>
  );
}
