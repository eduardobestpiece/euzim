import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AppPageFallback } from "@/components/app/app-page-fallback";
import { getCurrentUser } from "@/lib/auth/get-user";
import { resolveAppHomePath } from "@/lib/auth/routing";

async function AppIndexInner() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(resolveAppHomePath(user));
}

export default function AppIndexPage() {
  return (
    <Suspense fallback={<AppPageFallback label="Abrindo…" />}>
      <AppIndexInner />
    </Suspense>
  );
}
