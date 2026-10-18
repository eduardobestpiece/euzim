import { Suspense } from "react";
import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppPageFallback } from "@/components/app/app-page-fallback";
import { AppShell } from "@/components/app/app-shell";
import { PendingGiftsBanner } from "@/components/referral/pending-gifts-banner";
import { ShareAppButton } from "@/components/referral/share-app-button";
import { getCurrentUser } from "@/lib/auth/get-user";
import { ensureReferralCode } from "@/lib/referral/codes";

async function absoluteOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "http";
    if (host) return `${proto}://${host}`;
  } catch {
    /* ignore */
  }
  return "http://localhost:5050";
}

async function GiftsInner() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const code = await ensureReferralCode(user.id);
  const origin = await absoluteOrigin();
  const shareUrl = code ? `${origin}/r/${code}` : null;

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
          <ShareAppButton initialCode={code} initialUrl={shareUrl} />
          {!code ? (
            <p className="text-xs text-amber-800">
              Se o código não aparecer, aplique no SQL Editor do projeto Euzim
              (zlzgkivktvnyvehjwcjw) o arquivo{" "}
              <code className="rounded bg-muted px-1">
                supabase/migrations/20261017_referral_gifts.sql
              </code>
              . Enquanto isso, o app tenta gerar e guardar o código em
              fallback.
            </p>
          ) : null}
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
