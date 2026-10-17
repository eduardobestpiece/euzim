import Link from "next/link";
import { Baby, KeyRound, Shield, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PinGuardButton } from "@/components/kids/pin-guard";
import { signOutAction } from "@/lib/auth/actions";
import type { AuthUser } from "@/lib/auth/types";
import { PLATFORM_BUILD } from "@/lib/platform-build";

const links = [
  { href: "/app/parent", label: "Pais", icon: Users },
  { href: "/app/kids", label: "Kids", icon: Baby },
  { href: "/app/admin", label: "Admin", icon: Shield },
] as const;

export function AppShell({
  user,
  title,
  kidsMode = false,
  children,
}: {
  user: AuthUser;
  title: string;
  kidsMode?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-4 md:px-8">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-amber-600" aria-hidden />
          <span className="font-heading text-lg font-semibold">
            Estúdio Mágico
          </span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            / {title}
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-1">
          {kidsMode ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/app/kids" className="gap-1.5">
                  <Baby className="size-3.5" />
                  Kids
                </Link>
              </Button>
              <PinGuardButton label="Pais" href="/app/parent" />
            </>
          ) : (
            links.map(({ href, label, icon: Icon }) => (
              <Button key={href} asChild variant="ghost" size="sm">
                <Link href={href} className="gap-1.5">
                  <Icon className="size-3.5" />
                  {label}
                </Link>
              </Button>
            ))
          )}
          {!kidsMode ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link
                  href={
                    user.role === "admin"
                      ? "/app/admin/settings"
                      : "/app/parent/settings"
                  }
                  className="gap-1.5"
                >
                  <KeyRound className="size-3.5" />
                  Alterar senha
                </Link>
              </Button>
              <span
                className="hidden font-mono text-[10px] font-semibold text-emerald-800 sm:inline"
                title="Versão da plataforma"
              >
                {PLATFORM_BUILD}
              </span>
              <form action={signOutAction}>
                <Button type="submit" variant="outline" size="sm">
                  Sair
                </Button>
              </form>
            </>
          ) : null}
        </nav>
      </header>
      {!kidsMode ? (
        <div className="border-b border-border/50 bg-muted/30 px-4 py-2 text-xs text-muted-foreground md:px-8">
          {user.email}
          {user.isMock ? " · modo mock" : ""}
          {user.role === "admin" ? " · admin" : ""}
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-8">
        {children}
      </main>
    </div>
  );
}
