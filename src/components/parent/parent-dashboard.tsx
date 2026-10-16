"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StoryUsageTracker } from "@/components/parent/story-usage-tracker";
import { CharactersPanel } from "@/components/parent/characters-panel";
import type { StoryUsage } from "@/lib/stories/usage";

type CharacterRow = {
  id: string;
  name: string;
  isPrimary?: boolean;
};

export function ParentDashboard({
  usage,
  characters,
  childName,
}: {
  usage: StoryUsage;
  characters: CharacterRow[];
  childName?: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Painel dos Pais
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Acompanhe o uso mensal de histórias
          {childName ? ` de ${childName}` : ""} e gerencie personagens.
        </p>
      </div>

      <StoryUsageTracker usage={usage} />

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="characters">Gerenciar Personagens</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <section className="rounded-xl border border-border/70 p-5">
            <h2 className="font-heading text-lg font-semibold">Próximos passos</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Gerador de histórias com IA (Fase 4)</li>
              <li>Quiz e jogos ligados às histórias</li>
              <li>Página pública de compartilhamento</li>
            </ul>
          </section>
        </TabsContent>
        <TabsContent value="characters">
          <CharactersPanel characters={characters} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
