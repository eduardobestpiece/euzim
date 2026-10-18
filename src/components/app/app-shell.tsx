import { AppShellNav } from "@/components/app/app-shell-nav";
import type { AuthUser } from "@/lib/auth/types";

export function AppShell({
  user,
  title,
  kidsMode = false,
  wide = false,
  children,
}: {
  user: AuthUser;
  title: string;
  kidsMode?: boolean;
  /** Conteúdo mais largo / menos padding — modo leitura. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppShellNav user={user} title={title} kidsMode={kidsMode} />
      <main
        className={
          wide
            ? "mx-auto w-full max-w-5xl flex-1 px-2 py-4 md:px-4 md:py-6"
            : "mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-8"
        }
      >
        {children}
      </main>
    </div>
  );
}
