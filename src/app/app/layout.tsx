import { connection } from "next/server";
import { redirect } from "next/navigation";
import { SessionHeartbeat } from "@/components/app/session-heartbeat";
import { getCurrentUser } from "@/lib/auth/get-user";

export default async function AppAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
