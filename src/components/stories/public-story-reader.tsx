"use client";

import { StoryFlipbook } from "@/components/kids/story-flipbook";

type Page = {
  pageIndex: number;
  text: string;
  imageUrl: string;
  altText: string;
};

/** Leitura pública — modo imersivo (imagem fixa + texto rolável). */
export function PublicStoryReader({
  title,
  pages,
  shareToken,
  storyId,
}: {
  title: string;
  sourceLabel?: string;
  pages: Page[];
  shareToken: string;
  storyId?: string;
}) {
  return (
    <StoryFlipbook
      storyId={storyId || shareToken}
      title={title}
      pages={pages}
      questions={[]}
      shareToken={shareToken}
      readingMode
      showTitle
      backHref="/signup"
      backLabel="Criar minha história"
      showShare
    />
  );
}
