"use client";

import { StoryFlipbook } from "@/components/kids/story-flipbook";

type Page = {
  pageIndex: number;
  text: string;
  imageUrl: string;
  altText: string;
};

/** Leitura pública — mesmo modo leitura (setas / swipe / imagem sticky). */
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
    />
  );
}
