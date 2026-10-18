import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AppPageFallback } from "@/components/app/app-page-fallback";
import { SessionHeartbeat } from "@/components/app/session-heartbeat";
import { getCurrentUser } from "@/lib/auth/get-user";

/** Auth + connection() must run inside Suspense under cacheComponents. */
async function AppAreaGate({ children }: { children: React.ReactNode }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");
  return (
    <>
      <SessionHeartbeat />
      {children}
    </>
  );
}

export default function AppAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AppPageFallback />}>
      <AppAreaGate>{children}</AppAreaGate>
    </Suspense>
  );
}
