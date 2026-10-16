"use client";

import { useState } from "react";
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

type CharacterRow = {
  id: string;
  name: string;
  isPrimary?: boolean;
};

export function CharactersPanel({
  characters,
}: {
  characters: CharacterRow[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function buyPack(pack: CharacterPack) {
    setSelected(pack.id);
    setMessage(
      `Pacote “${pack.name}” (${formatBrl(pack.priceBrl)}) — Stripe entra nas próximas fases. Seleção salva localmente.`,
    );
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
            Expanda o elenco da família. Pagamento real (Stripe) nas fases
            seguintes — aqui é só a vitrine.
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
              <CardFooter>
                <Button
                  className="w-full"
                  variant={selected === pack.id ? "secondary" : "default"}
                  onClick={() => buyPack(pack)}
                >
                  {selected === pack.id ? "Selecionado" : "Quero este"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {message ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
