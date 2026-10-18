import { Suspense } from "react";
import { connection } from "next/server";
import { AuthForm } from "@/components/auth/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  onboardingPathForPlan,
  parseSelectedPlanId,
} from "@/lib/billing/selected-plan";

async function SignupPageInner({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; plan?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const plan = parseSelectedPlanId(params.plan);
  const explicitNext =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : null;
  const nextPath = explicitNext ?? (plan ? onboardingPathForPlan(plan) : null);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.03_200),_transparent_55%)] px-4 py-16">
      <AuthForm
        mode="signup"
        mockMode={!isSupabaseConfigured()}
        nextPath={nextPath}
      />
    </main>
  );
}

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; plan?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16 text-sm text-muted-foreground">
          Carregando…
        </main>
      }
    >
      <SignupPageInner searchParams={searchParams} />
    </Suspense>
  );
}
