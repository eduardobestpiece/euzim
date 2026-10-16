import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getCurrentUser } from "@/lib/auth/get-user";
import { loadAdminDashboard } from "@/lib/admin/load-dashboard";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/app/parent");

  const { kpis, accounts, error } = await loadAdminDashboard();

  return (
    <AppShell user={user} title="Admin">
      <AdminDashboard kpis={kpis} accounts={accounts} loadError={error} />
    </AppShell>
  );
}
