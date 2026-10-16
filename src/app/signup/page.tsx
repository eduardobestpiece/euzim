import { AuthForm } from "@/components/auth/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function SignupPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_top,_oklch(0.94_0.03_200),_transparent_55%)] px-4 py-16">
      <AuthForm mode="signup" mockMode={!isSupabaseConfigured()} />
    </main>
  );
}
