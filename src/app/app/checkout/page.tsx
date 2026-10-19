import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AppPageFallback } from "@/components/app/app-page-fallback";
import { AppShell } from "@/components/app/app-shell";
import { EmbeddedCheckoutClient } from "@/components/checkout/embedded-checkout";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function CheckoutPageInner() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/checkout");

  let phone: string | null = null;
  const db = createAdminClient() ?? (await createClient());
  if (db) {
    const { data } = await db
      .from("users")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle();
    phone = data?.phone ?? null;
  }

  return (
    <AppShell user={user} title="Checkout">
      <div className="mx-auto w-full max-w-2xl">
        <EmbeddedCheckoutClient
          userEmail={user.email}
          userId={user.id}
          fullName={user.fullName}
          phone={phone}
        />
      </div>
    </AppShell>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<AppPageFallback label="Carregando checkout…" />}>
      <CheckoutPageInner />
    </Suspense>
  );
}
