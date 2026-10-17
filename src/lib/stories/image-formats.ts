/**
 * Formatos de imagem das histórias (OpenAI Images).
 * - Páginas normais: landscape ~3:2 (próximo do 16:10 do reader).
 * - Última página (wallpaper): portrait mobile 2:3 com quadro seguro
 *   central ~16:10 para o recorte da história.
 */

export const STORY_PAGE_SIZE = "1536x1024" as const;
export const STORY_WALLPAPER_SIZE = "1024x1536" as const;

export type StoryImageSize =
  | typeof STORY_PAGE_SIZE
  | typeof STORY_WALLPAPER_SIZE;

/** Reader mostra ~16:10; o wallpaper portrait precisa do conteúdo principal no centro. */
export const STORY_SAFE_FRAME_HINT = [
  "COMPOSITION FOR MOBILE WALLPAPER (portrait 2:3 / 1024x1536):",
  "Keep the MAIN story action, faces of the child and companion, and key props inside a CENTER horizontal SAFE FRAME",
  "approximately the middle 42% of the image height (a 16:10 landscape window centered vertically).",
  "Extend sky, room, ground, or soft environment ABOVE and BELOW that safe frame so the full portrait works as a phone wallpaper.",
  "Do NOT place critical faces, text, or the main action only in the top or bottom margins — those margins are wallpaper fill and may be cropped in the story reader.",
  "When the story reader crops to 16:10 landscape from the center, the scene must still look natural and complete.",
].join(" ");

export function imageSizeForStoryPage(
  pageIndex: number,
  totalPages: number,
): StoryImageSize {
  if (totalPages > 0 && pageIndex === totalPages - 1) {
    return STORY_WALLPAPER_SIZE;
  }
  return STORY_PAGE_SIZE;
}

export function isWallpaperStoryPage(
  pageIndex: number,
  totalPages: number,
): boolean {
  return imageSizeForStoryPage(pageIndex, totalPages) === STORY_WALLPAPER_SIZE;
}
