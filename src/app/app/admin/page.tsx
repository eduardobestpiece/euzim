import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AppPageFallback } from "@/components/app/app-page-fallback";
import { AppShell } from "@/components/app/app-shell";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getCurrentUser } from "@/lib/auth/get-user";
import { loadAdminDashboard } from "@/lib/admin/load-dashboard";
import { loadPixelsAdminAction } from "@/lib/admin/pixels-actions";

async function AdminPageInner() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/app/parent");

  const [{ kpis, accounts, error }, pixelsBundle] = await Promise.all([
    loadAdminDashboard(),
    loadPixelsAdminAction(),
  ]);

  return (
    <AppShell user={user} title="Admin">
      <AdminDashboard
        kpis={kpis}
        accounts={accounts}
        loadError={error}
        pixelsBundle={pixelsBundle}
      />
    </AppShell>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AppPageFallback label="Carregando admin…" />}>
      <AdminPageInner />
    </Suspense>
  );
}
