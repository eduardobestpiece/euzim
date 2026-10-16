"use client";

import { useState, useTransition } from "react";
import { Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CHARACTER_PACKS,
  formatBrl,
  type CharacterPack,
} from "@/lib/billing/character-packs";
import {
  mockActivatePackAction,
  startCharacterPackCheckoutAction,
} from "@/lib/stripe/checkout-actions";
import type { BillingSnapshot } from "@/components/parent/subscription-panel";

type CharacterRow = {
  id: string;
  name: string;
  isPrimary?: boolean;
};

export function CharactersPanel({
  characters,
  billing,
}: {
  characters: CharacterRow[];
  billing: BillingSnapshot;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buyPack(pack: CharacterPack) {
    setSelected(pack.id);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await startCharacterPackCheckoutAction(pack.id);
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      if (result.error) setError(result.error);
      if (!billing.stripeReady) {
        setMessage(
          `Checkout real indisponível. Use “Simular compra” para creditar ${pack.characters} personagem(ns) localmente.`,
        );
      }
    });
  }

  function simulatePack(pack: CharacterPack) {
    setSelected(pack.id);
    setError(null);
    startTransition(async () => {
      const result = await mockActivatePackAction(pack.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(
        `Pacote “${pack.name}” creditado (simulado). Extras: +${pack.characters}.`,
      );
      window.location.reload();
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-xl font-semibold">
            Seus personagens
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Extras disponíveis: {billing.extraCharacters ?? 0}
        </p>
        {characters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum personagem ainda. Crie no onboarding ou compre um pacote
            abaixo.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {characters.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3"
              >
                <span className="font-medium">{c.name}</span>
                {c.isPrimary ? <Badge>principal</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 font-heading text-xl font-semibold">
            <Sparkles className="size-4 text-amber-600" />
            Pacotes extras
          </h2>
          <p className="text-sm text-muted-foreground">
            Upsell via Stripe Checkout (pagamento único). Preços do brief MVP.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHARACTER_PACKS.map((pack) => (
            <Card
              key={pack.id}
              className={`shadow-none ${
                pack.highlight ? "border-amber-600/50" : ""
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{pack.name}</CardTitle>
                  {pack.highlight ? (
                    <Badge variant="secondary">popular</Badge>
                  ) : null}
                </div>
                <CardDescription>{pack.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-heading text-2xl font-semibold">
                  {formatBrl(pack.priceBrl)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pack.characters} personagem
                  {pack.characters > 1 ? "s" : ""}
                </p>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button
                  className="w-full"
                  variant={selected === pack.id ? "secondary" : "default"}
                  disabled={pending}
                  onClick={() => buyPack(pack)}
                >
                  {pending && selected === pack.id
                    ? "Abrindo…"
                    : "Comprar com Stripe"}
                </Button>
                {!billing.stripeReady ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={pending}
                    onClick={() => simulatePack(pack)}
                  >
                    Simular compra
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          ))}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
