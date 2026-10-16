import type { GeneratedStory } from "@/lib/stories/generate-mock";
import { generateMockStory } from "@/lib/stories/generate-mock";

const UNSplash = [
  "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=800&q=80",
];

type OpenAiStoryJson = {
  title?: string;
  pages?: { text?: string }[];
};

export type GenerateStoryTextResult = {
  story: GeneratedStory;
  engine: "openai-gpt-4o-mini" | "mock-v1";
};

/** Gera texto via GPT-4o-mini; imagens Unsplash; fallback mock se falhar. */
export async function generateStoryText(input: {
  childName: string;
  theme: string;
}): Promise<GenerateStoryTextResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      story: generateMockStory(input),
      engine: "mock-v1",
    };
  }

  try {
    const name = input.childName.trim() || "a criança";
    const theme = input.theme.trim() || "uma floresta encantada";

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Você escreve histórias infantis curtas em português do Brasil. Responda SOMENTE JSON válido no formato: {\"title\": string, \"pages\": [{\"text\": string}, {\"text\": string}, {\"text\": string}, {\"text\": string}]}. Exatamente 4 páginas. Tom acolhedor, sem violência, adequado a crianças de 4–8 anos. Cada página: 2–4 frases.",
          },
          {
            role: "user",
            content: `Protagonista: ${name}. Tema/cenário: ${theme}. Inclua o nome da criança na história.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return { story: generateMockStory(input), engine: "mock-v1" };
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) {
      return { story: generateMockStory(input), engine: "mock-v1" };
    }

    const parsed = JSON.parse(raw) as OpenAiStoryJson;
    const texts = (parsed.pages ?? [])
      .map((p) => (typeof p?.text === "string" ? p.text.trim() : ""))
      .filter(Boolean);

    if (texts.length < 4) {
      return { story: generateMockStory(input), engine: "mock-v1" };
    }

    const title =
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : `${name} e ${theme}`;

    const pages = [0, 1, 2, 3].map((pageIndex) => ({
      pageIndex,
      text: texts[pageIndex],
      imageUrl: UNSplash[pageIndex] ?? UNSplash[0],
      altText: `Ilustração da página ${pageIndex + 1} — ${name} em ${theme}`,
    }));

    return {
      story: {
        title,
        pages,
        coverImageUrl: pages[0].imageUrl,
        textContent: {
          pages: pages.map((p) => ({ index: p.pageIndex, text: p.text })),
        },
      },
      engine: "openai-gpt-4o-mini",
    };
  } catch {
    return { story: generateMockStory(input), engine: "mock-v1" };
  }
}
