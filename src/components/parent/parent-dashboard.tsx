"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StoryUsageTracker } from "@/components/parent/story-usage-tracker";
import { CharactersPanel, type CharacterManageRow } from "@/components/parent/characters-panel";
import { NewStoryForm } from "@/components/parent/new-story-form";
import type { BillingSnapshot } from "@/components/parent/subscription-panel";
import {
  StoryJobNotifier,
  trackStoryJob,
} from "@/components/parent/story-job-notifier";
import { WallpaperDialog } from "@/components/parent/wallpaper-dialog";
import { ShareProfileButton } from "@/components/social/share-profile-button";
import { VisibilityToggle } from "@/components/social/visibility-toggle";
import type { StoryUsage } from "@/lib/stories/usage";
import type { ChildFamilyMeta } from "@/lib/characters/types";
import type { StoryVisibility } from "@/lib/social/types";

type StoryListItem = {
  id: string;
  title: string;
  coverImageUrl?: string | null;
  wallpaperImageUrl?: string | null;
  createdAt?: string;
  visibility?: StoryVisibility;
};

export function ParentDashboard({
  usage,
  characters,
  childName,
  childAvatarUrl,
  childAgeYears,
  childMeta,
  stories,
  billing,
}: {
  usage: StoryUsage;
  characters: CharacterManageRow[];
  childName?: string | null;
  childAvatarUrl?: string | null;
  childAgeYears?: number | null;
  childMeta?: ChildFamilyMeta | null;
  stories: StoryListItem[];
  billing: BillingSnapshot;
}) {
  const remaining = Math.max(0, usage.limit - usage.used);
  const primary =
    characters.find((c) => c.isPrimary) ?? characters[0] ?? null;
  const friend = characters.find((c) => !c.isPrimary) ?? null;
  const heroUrl = childAvatarUrl || primary?.avatarUrl || null;
  const heroName = childName || primary?.name || "sua criança";
  const isFirstStory = stories.length === 0;
  const [tab, setTab] = useState("create");

  const onJobQueued = useCallback((jobId: string) => {
    trackStoryJob(jobId);
  }, []);

  return (
    <div className="space-y-6">
      <StoryJobNotifier />

      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-[radial-gradient(ellipse_at_top_left,_oklch(0.95_0.04_85),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_oklch(0.94_0.03_210),_transparent_50%)] p-5 sm:p-7">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end">
          <div className="relative">
            <div className="size-36 overflow-hidden rounded-3xl border-4 border-background shadow-md sm:size-44">
              {heroUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroUrl}
                  alt={heroName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                  <Sparkles className="size-8" />
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 space-y-2 text-center sm:pb-1 sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Avatar pronto
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              {heroName}
            </h1>
            <p className="max-w-md text-sm text-muted-foreground sm:text-base">
              {isFirstStory
                ? "O personagem mágico está pronto. Crie a primeira aventura com o avatar da sua criança."
                : "Escolha um tema e crie mais uma aventura com o elenco da família."}
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-1 sm:justify-start">
              <Button asChild size="lg">
                <a href="#criar-historia">
                  {isFirstStory ? "Criar primeira história" : "Criar história"}
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link href="/app/kids">Abrir Kids</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/app/social">Social</Link>
              </Button>
            </div>
            <div className="flex justify-center pt-2 sm:justify-start">
              <ShareProfileButton />
            </div>
          </div>
        </div>
      </section>

      <StoryUsageTracker usage={usage} />

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="create">Nova História</TabsTrigger>
          <TabsTrigger value="library">Biblioteca</TabsTrigger>
          <TabsTrigger value="characters">Personagens</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4" id="criar-historia">
          <NewStoryForm
            childName={childName}
            friendName={friend?.name ?? null}
            remaining={remaining}
            characters={characters}
            childAgeYears={childAgeYears ?? null}
            onJobQueued={onJobQueued}
          />
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          {stories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há histórias. Crie a primeira na aba Nova História.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {stories.map((story) => {
                const wallpaperUrl =
                  story.wallpaperImageUrl || story.coverImageUrl || "";
                return (
                  <li
                    key={story.id}
                    className="rounded-xl border border-border/70 p-3 transition hover:border-foreground/40"
                  >
                    <div className="flex gap-3">
                      <Link
                        href={`/app/parent/stories/${story.id}`}
                        className="flex min-w-0 flex-1 gap-3"
                      >
                        {story.coverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={story.coverImageUrl}
                            alt=""
                            className="size-16 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div className="size-16 shrink-0 rounded-md bg-muted" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{story.title}</p>
                          {story.createdAt ? (
                            <p className="text-xs text-muted-foreground">
                              {story.createdAt
                                .slice(0, 10)
                                .split("-")
                                .reverse()
                                .join("/")}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    </div>
                    <div className="mt-3 space-y-2">
                      <VisibilityToggle
                        storyId={story.id}
                        initial={story.visibility ?? "private"}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/app/parent/stories/${story.id}`}>
                            Ler
                          </Link>
                        </Button>
                        {wallpaperUrl ? (
                          <WallpaperDialog
                            imageUrl={wallpaperUrl}
                            title={story.title}
                            triggerLabel="Wallpaper"
                            size="sm"
                            variant="secondary"
                          />
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="characters">
          <CharactersPanel
            characters={characters}
            billing={billing}
            childMeta={childMeta ?? null}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
