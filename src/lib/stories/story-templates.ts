import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type TemplatePage = {
  title: string;
  text: string;
  image_prompt: string;
};

export type TemplateSkeleton = {
  moral: string;
  fullText: string;
  pages: TemplatePage[];
  theme?: string;
  storyType?: string | null;
  anonymized?: boolean;
};

export type PersonalizedStory = {
  title: string;
  moral: string;
  fullText: string;
  pages: {
    index: number;
    title: string;
    text: string;
    imagePrompt: string;
  }[];
};

export type MatchedTemplate = {
  id: string;
  title: string;
  skeleton: TemplateSkeleton;
  score: number;
};

const STOP = new Set([
  "a",
  "o",
  "os",
  "as",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "um",
  "uma",
  "com",
  "para",
  "por",
  "que",
  "na",
  "no",
  "ao",
  "à",
  "historia",
  "história",
  "sobre",
  "meu",
  "minha",
  "filho",
  "filha",
]);

export function themeTags(theme: string): string[] {
  return theme
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9à-ú]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .slice(0, 12);
}

export function anonymizeNames(
  text: string,
  childName: string,
  friendName: string,
): string {
  let out = text;
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (childName.trim()) {
    out = out.replace(new RegExp(escape(childName.trim()), "gi"), "[NOME]");
  }
  if (friendName.trim()) {
    out = out.replace(new RegExp(escape(friendName.trim()), "gi"), "[AMIGO]");
  }
  return out;
}

export function personalizeNames(
  text: string,
  childName: string,
  friendName: string,
): string {
  return text
    .replace(/\[NOME\]/gi, childName)
    .replace(/\[AMIGO\]/gi, friendName)
    .replace(/\[CHILD\]/gi, childName)
    .replace(/\[FRIEND\]/gi, friendName);
}

function scoreTags(query: string[], candidate: string[]): number {
  if (query.length === 0 || candidate.length === 0) return 0;
  const set = new Set(candidate.map((t) => t.toLowerCase()));
  let hit = 0;
  for (const t of query) {
    if (set.has(t.toLowerCase())) hit += 1;
  }
  return hit / query.length;
}

/**
 * Busca template cacheável por sobreposição de theme_tags / moral.
 */
export async function findMatchingTemplate(input: {
  theme: string;
  moralHint?: string;
  userId?: string | null;
}): Promise<MatchedTemplate | null> {
  const db = createAdminClient() ?? (await createClient());
  if (!db) return null;

  const tags = themeTags(input.theme);
  const { data, error } = await db
    .from("story_templates")
    .select("id, title, synopsis, theme_tags, prompt_skeleton, created_by")
    .eq("is_active", true)
    .eq("locale", "pt-BR")
    .order("updated_at", { ascending: false })
    .limit(40);

  if (error || !data?.length) return null;

  let best: MatchedTemplate | null = null;
  for (const row of data) {
    const skeleton = row.prompt_skeleton as TemplateSkeleton | null;
    if (!skeleton?.fullText || !Array.isArray(skeleton.pages)) continue;
    if (skeleton.pages.length < 5) continue;

    let score = scoreTags(tags, row.theme_tags ?? []);
    if (input.moralHint && skeleton.moral) {
      const m = skeleton.moral.toLowerCase();
      const h = input.moralHint.toLowerCase();
      if (m.includes(h.slice(0, 24)) || h.includes(m.slice(0, 24))) {
        score += 0.25;
      }
    }
    if (row.synopsis) {
      const synTags = themeTags(row.synopsis);
      score += scoreTags(tags, synTags) * 0.35;
    }
    // Prefere templates do próprio parent ligeiramente
    if (input.userId && row.created_by === input.userId) score += 0.1;

    if (score < 0.35) continue;
    if (!best || score > best.score) {
      best = {
        id: row.id,
        title: row.title,
        skeleton,
        score,
      };
    }
  }
  return best;
}

export function personalizeSkeleton(
  skeleton: TemplateSkeleton,
  childName: string,
  friendName: string,
  templateTitle?: string,
): PersonalizedStory {
  const pages = skeleton.pages.map((p, i) => ({
    index: i,
    title: personalizeNames(p.title || `Parte ${i + 1}`, childName, friendName),
    text: personalizeNames(p.text, childName, friendName),
    imagePrompt: personalizeNames(
      p.image_prompt || "",
      childName,
      friendName,
    ),
  }));
  return {
    title: personalizeNames(
      templateTitle || `${childName} e a aventura`,
      childName,
      friendName,
    ),
    moral: personalizeNames(skeleton.moral || "", childName, friendName),
    fullText: personalizeNames(skeleton.fullText, childName, friendName),
    pages,
  };
}

/** Grava template anonimizado para reuso futuro. */
export async function saveStoryTemplate(input: {
  userId: string;
  theme: string;
  title: string;
  moral: string;
  fullText: string;
  pages: {
    title: string;
    text: string;
    imagePrompt: string;
  }[];
  childName: string;
  friendName: string;
  storyType?: string | null;
}): Promise<string | null> {
  const db = createAdminClient() ?? (await createClient());
  if (!db) return null;

  const tags = themeTags(input.theme);
  const slugBase = tags.slice(0, 4).join("-") || "historia";
  const slug = `${slugBase}-${Date.now().toString(36)}`.slice(0, 80);

  const skeleton: TemplateSkeleton = {
    moral: anonymizeNames(input.moral, input.childName, input.friendName),
    fullText: anonymizeNames(input.fullText, input.childName, input.friendName),
    pages: input.pages.map((p) => ({
      title: anonymizeNames(p.title, input.childName, input.friendName),
      text: anonymizeNames(p.text, input.childName, input.friendName),
      image_prompt: anonymizeNames(
        p.imagePrompt,
        input.childName,
        input.friendName,
      ),
    })),
    theme: input.theme,
    storyType: input.storyType ?? null,
    anonymized: true,
  };

  const { data, error } = await db
    .from("story_templates")
    .insert({
      slug,
      title: anonymizeNames(input.title, input.childName, input.friendName),
      synopsis: anonymizeNames(
        input.moral || input.theme,
        input.childName,
        input.friendName,
      ),
      locale: "pt-BR",
      theme_tags: tags,
      prompt_skeleton: skeleton,
      is_public: false,
      is_active: true,
      created_by: input.userId,
      version: 1,
    })
    .select("id")
    .maybeSingle();

  if (error) return null;
  return data?.id ?? null;
}
