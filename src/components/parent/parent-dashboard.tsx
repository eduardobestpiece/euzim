"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StoryUsageTracker } from "@/components/parent/story-usage-tracker";
import { CharactersPanel } from "@/components/parent/characters-panel";
import { NewStoryForm } from "@/components/parent/new-story-form";
import type { StoryUsage } from "@/lib/stories/usage";

type CharacterRow = {
  id: string;
  name: string;
  isPrimary?: boolean;
};

type StoryListItem = {
  id: string;
  title: string;
  coverImageUrl?: string | null;
  createdAt?: string;
};

export function ParentDashboard({
  usage,
  characters,
  childName,
  stories,
}: {
  usage: StoryUsage;
  characters: CharacterRow[];
  childName?: string | null;
  stories: StoryListItem[];
}) {
  const remaining = Math.max(0, usage.limit - usage.used);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Painel dos Pais
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Acompanhe o uso mensal de histórias
          {childName ? ` de ${childName}` : ""}, gere novas aventuras e gerencie
          personagens.
        </p>
      </div>

      <StoryUsageTracker usage={usage} />

      <Tabs defaultValue="create" className="gap-4">
        <TabsList>
          <TabsTrigger value="create">Nova História</TabsTrigger>
          <TabsTrigger value="library">Biblioteca</TabsTrigger>
          <TabsTrigger value="characters">Gerenciar Personagens</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <NewStoryForm childName={childName} remaining={remaining} />
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          {stories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há histórias. Crie a primeira na aba Nova História.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {stories.map((story) => (
                <li key={story.id}>
                  <Link
                    href={`/app/parent/stories/${story.id}`}
                    className="flex gap-3 rounded-xl border border-border/70 p-3 transition hover:border-foreground/40"
                  >
                    {story.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={story.coverImageUrl}
                        alt=""
                        className="size-16 rounded-md object-cover"
                      />
                    ) : (
                      <div className="size-16 rounded-md bg-muted" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{story.title}</p>
                      {story.createdAt ? (
                        <p className="text-xs text-muted-foreground">
                          {new Date(story.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="characters">
          <CharactersPanel characters={characters} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
