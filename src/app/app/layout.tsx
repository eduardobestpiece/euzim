import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-user";

export default async function AppAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");
  return children;
}
