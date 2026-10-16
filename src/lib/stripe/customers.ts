import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";

/** Garante customer Stripe e persiste stripe_customer_id em public.users. */
export async function ensureStripeCustomer(input: {
  userId: string;
  email: string;
  fullName?: string | null;
}): Promise<{ customerId: string | null; error?: string }> {
  const stripe = getStripe();
  if (!stripe) {
    return { customerId: null, error: "Stripe secret inválida ou ausente." };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { customerId: null, error: "Admin Supabase indisponível." };
  }

  const { data: profile } = await admin
    .from("users")
    .select("stripe_customer_id, email, full_name")
    .eq("id", input.userId)
    .maybeSingle();

  if (profile?.stripe_customer_id) {
    return { customerId: profile.stripe_customer_id };
  }

  try {
    const customer = await stripe.customers.create({
      email: input.email || profile?.email || undefined,
      name: input.fullName || profile?.full_name || undefined,
      metadata: {
        supabase_user_id: input.userId,
        project: "zlzgkivktvnyvehjwcjw",
      },
    });

    const { error } = await admin
      .from("users")
      .update({ stripe_customer_id: customer.id })
      .eq("id", input.userId);

    if (error) {
      return { customerId: customer.id, error: error.message };
    }

    return { customerId: customer.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao criar customer.";
    return { customerId: null, error: message };
  }
}
