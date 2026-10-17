"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  signInAction,
  signUpAction,
  type AuthActionResult,
} from "@/lib/auth/actions";

type Mode = "login" | "signup";

const initial: AuthActionResult = {};

export function AuthForm({
  mode,
  mockMode,
}: {
  mode: Mode;
  mockMode: boolean;
}) {
  const action = mode === "login" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <Card className="w-full max-w-md border-border/60 shadow-none">
      <CardHeader className="space-y-4">
        <BrandLogo size="auth" href="/" priority className="mx-auto sm:mx-0" />
        <div className="space-y-1.5">
          <CardTitle className="font-heading text-2xl">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Acesse o Euzim com seu e-mail."
              : "Comece a personalizar histórias para sua criança."}
          </CardDescription>
        </div>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          {mockMode ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Modo demo ativo — conta em nuvem não configurada. Sessão
              fica em cookies locais.
            </p>
          ) : null}
          {mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="fullName">Seu nome</Label>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                placeholder="Maria Silva"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="voce@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3">
          <Button type="submit" disabled={pending} size="lg">
            {pending
              ? "Aguarde…"
              : mode === "login"
                ? "Entrar"
                : "Criar conta"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Não tem conta?{" "}
                <Link href="/signup" className="text-foreground underline">
                  Cadastre-se
                </Link>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <Link href="/login" className="text-foreground underline">
                  Entrar
                </Link>
              </>
            )}
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
