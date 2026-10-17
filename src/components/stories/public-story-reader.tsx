"use client";

import { useImagePalette } from "@/hooks/use-image-palette";
import {
  paletteBackgroundStyle,
  type StoryPalette,
} from "@/lib/stories/palette";

type Page = {
  pageIndex: number;
  text: string;
  imageUrl: string;
  altText: string;
};

function PageBlock({
  page,
  fallbackPalette,
}: {
  page: Page;
  fallbackPalette?: StoryPalette;
}) {
  const palette = useImagePalette(page.imageUrl || null);
  const active = page.imageUrl ? palette : fallbackPalette ?? palette;

  return (
    <article
      className="overflow-hidden rounded-2xl shadow-[0_20px_50px_-30px_rgba(0,0,0,0.4)] transition-[background] duration-500"
      style={{
        background: active.panelBg,
        border: `1px solid ${active.panelBorder}`,
        color: active.text,
      }}
    >
      {page.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.imageUrl}
          alt={page.altText}
          crossOrigin="anonymous"
          className="aspect-[16/10] w-full object-cover"
          loading={page.pageIndex === 0 ? "eager" : "lazy"}
        />
      ) : null}
      <div className="space-y-2 p-4 sm:p-5">
        <p
          className="text-[11px] font-medium uppercase tracking-wide"
          style={{ color: active.textMuted }}
        >
          Página {page.pageIndex + 1}
        </p>
        <p
          className="text-sm leading-relaxed sm:text-base sm:leading-7"
          style={{ color: active.text }}
        >
          {page.text}
        </p>
      </div>
    </article>
  );
}

export function PublicStoryReader({
  title,
  sourceLabel,
  pages,
}: {
  title: string;
  sourceLabel?: string;
  pages: Page[];
}) {
  const coverPalette = useImagePalette(pages[0]?.imageUrl || null);

  return (
    <div
      className="relative min-h-full transition-[background] duration-700"
      style={paletteBackgroundStyle(coverPalette)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: `radial-gradient(ellipse at 10% 0%, ${coverPalette.glow}, transparent 45%), radial-gradient(ellipse at 90% 100%, ${coverPalette.accent}40, transparent 40%)`,
        }}
        aria-hidden
      />
      <div className="relative z-10 mx-auto max-w-3xl space-y-6 px-4 pb-28 pt-6 md:px-6 md:pt-10">
        <div className="space-y-2">
          {sourceLabel ? (
            <p
              className="text-xs font-medium uppercase tracking-wide sm:text-sm"
              style={{ color: coverPalette.textMuted }}
            >
              {sourceLabel}
            </p>
          ) : null}
          <h1
            className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl"
            style={{ color: coverPalette.text }}
          >
            {title}
          </h1>
        </div>

        <div className="space-y-5">
          {pages.map((page) => (
            <PageBlock
              key={page.pageIndex}
              page={page}
              fallbackPalette={coverPalette}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
