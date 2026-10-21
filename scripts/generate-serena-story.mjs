/**
 * Gera 1 história Contador Sábio + imagens Pixar para Eduardo/Serena/Bingo.
 * Uso: node scripts/generate-serena-story.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import sharp from "sharp";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const OPENAI_KEY = env.OPENROUTER_API_KEY || env.OPENAI_API_KEY;
const USE_OPENROUTER = Boolean(env.OPENROUTER_API_KEY);
const AI_BASE = USE_OPENROUTER
  ? "https://openrouter.ai/api/v1"
  : "https://api.openai.com/v1";
const STORY_MODEL =
  env.OPENROUTER_STORY_MODEL ||
  env.OPENAI_STORY_MODEL ||
  (USE_OPENROUTER ? "anthropic/claude-sonnet-4.5" : "gpt-4o");
const IMAGE_MODEL =
  env.OPENROUTER_IMAGE_MODEL ||
  env.OPENAI_IMAGE_MODEL ||
  (USE_OPENROUTER ? "openai/gpt-image-2" : "gpt-image-2");
const USER_ID = "1615adf6-fbe2-4caf-99f1-577915f5c7b9";
const THEME =
  "Uma menina que tinha medo de moradores de rua e venceu esse medo com compaixão, coragem e amizade — profunda, com diálogos e parábolas leves, adequada a crianças.";

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const SKILL = `Você é o Contador Sábio do Estúdio Mágico: fabulista + Disney/Pixar.
Escreva em português do Brasil. Protagonistas obrigatórios: Serena (criança) e Bingo (brinquedo favorito / companheiro).
História profunda, oral, com diálogos, analogias e arco completo. Sem violência. Empatia com pessoas em situação de rua.`;

async function chatJson(system, user, temperature = 0.7) {
  const res = await fetch(`${AI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
      ...(USE_OPENROUTER
        ? {
            "HTTP-Referer": env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:5050",
            "X-Title": "Euzim",
          }
        : {}),
    },
    body: JSON.stringify({
      model: STORY_MODEL,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(180000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `chat ${res.status}`);
  return JSON.parse(json.choices[0].message.content);
}

async function fetchBuf(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function prepare(bytes) {
  return sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

async function imageEdit(prompt, images) {
  if (USE_OPENROUTER) {
    const body = {
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      aspect_ratio: "1:1",
      quality: "medium",
      input_references: images.map((buf) => ({
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${buf.toString("base64")}`,
        },
      })),
    };
    const res = await fetch(`${AI_BASE}/images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:5050",
        "X-Title": "Euzim",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || `img ${res.status}`);
    return Buffer.from(json.data[0].b64_json, "base64");
  }

  const form = new FormData();
  form.set("model", IMAGE_MODEL);
  form.set("prompt", prompt);
  form.set("size", "1024x1024");
  form.set("quality", "medium");
  form.set("output_format", "jpeg");
  images.forEach((buf, i) =>
    form.append(
      "image[]",
      new File([buf], `ref-${i}.jpg`, { type: "image/jpeg" }),
    ),
  );
  const res = await fetch(`${AI_BASE}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    body: form,
    signal: AbortSignal.timeout(180000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `img ${res.status}`);
  return Buffer.from(json.data[0].b64_json, "base64");
}

async function upload(path, jpeg) {
  const { error } = await db.storage
    .from("avatars")
    .upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

const { data: child } = await db
  .from("children")
  .select("id, display_name, preferences, avatar_url")
  .eq("parent_id", USER_ID)
  .limit(1)
  .single();

const pixar = child.preferences?.pixar || {};
console.log("cast", {
  child: child.display_name,
  friend: child.preferences?.friend,
  hasPixar: Boolean(pixar.child_hero && pixar.friend_hero),
});

console.log("1) draft…");
const draft = await chatJson(
  `${SKILL}\nResponda JSON: {"title","moral","full_text"} com full_text 900-1600 palavras.`,
  `Tema dos pais: """${THEME}"""\nProtagonistas: Serena + Bingo (brinquedo).`,
  0.85,
);
console.log("draft words", draft.full_text.split(/\s+/).length, draft.title);

console.log("2) review…");
const reviewed = await chatJson(
  `${SKILL}\nVocê é o EDITOR. Reescreva melhor. JSON: {"title","moral","full_text","review_notes"}`,
  `Tema: ${THEME}\nRascunho:\n${draft.full_text}`,
  0.5,
);
console.log(
  "reviewed words",
  reviewed.full_text.split(/\s+/).length,
  reviewed.title,
);

console.log("3) split 6-8 pages…");
const split = await chatJson(
  `${SKILL}\nDivida em 6 a 8 atos. Cada ato ~160-200 palavras + image_prompt em inglês Pixar.
JSON: {"pages":[{"index":0,"title","text","image_prompt"}]}`,
  `Título: ${reviewed.title}\n\n${reviewed.full_text}`,
  0.4,
);
const pages = (split.pages || []).slice(0, 8);
console.log("pages", pages.length, pages.map((p) => p.text?.length));

const refUrls = [
  pixar.child_hero,
  pixar.friend_hero,
  pixar.child_face_sheet,
  pixar.friend_sheet,
].filter(Boolean);
const refs = [];
for (const u of refUrls) {
  const raw = await fetchBuf(u);
  if (raw) refs.push(await prepare(raw));
}
console.log("refs", refs.length);

const storyKey = crypto.randomUUID();
const illustrated = [];
for (let i = 0; i < pages.length; i++) {
  const p = pages[i];
  console.log(`4) image page ${i + 1}/${pages.length}…`);
  const prompt = [
    p.image_prompt || `Pixar scene ${i + 1}`,
    `Walt Disney / Pixar 3D animated cinematic still.`,
    `Feature THIS exact child Serena and THIS exact toy companion Bingo from the reference images as clear protagonists.`,
    `Preserve Pixar look from references. Soft lighting, wholesome, no text, no watermark, no photorealism.`,
  ].join(" ");
  let imageUrl = "";
  try {
    const jpeg = await imageEdit(prompt, refs.slice(0, 4));
    imageUrl = await upload(
      `${USER_ID}/stories/${storyKey}/page-${i}.jpg`,
      jpeg,
    );
    console.log("  ok", imageUrl.slice(0, 90));
  } catch (e) {
    console.warn("  img fail", e.message);
  }
  illustrated.push({
    index: i,
    title: p.title || `Parte ${i + 1}`,
    text: p.text,
    image_prompt: prompt,
    imageUrl,
  });
}

const cover = illustrated.find((p) => p.imageUrl)?.imageUrl || null;
const textContent = {
  moral: reviewed.moral,
  reviewNotes: reviewed.review_notes,
  fullText: reviewed.full_text,
  pages: illustrated.map((p) => ({
    index: p.index,
    title: p.title,
    text: p.text,
    image_prompt: p.image_prompt,
  })),
};

const { data: story, error } = await db
  .from("stories")
  .insert({
    parent_id: USER_ID,
    child_id: child.id,
    title: reviewed.title,
    status: "ready",
    is_public: true,
    text_content: textContent,
    questions_data: [],
    cover_image_url: cover,
    generation_meta: {
      engine: "openai-storyteller-v1",
      pipeline: "draft-review-split-pixar",
      pages: illustrated.length,
      theme: THEME,
      friend: child.preferences?.friend,
      moral: reviewed.moral,
      stamp: "v17-storyteller-live",
    },
    published_at: new Date().toISOString(),
  })
  .select("id, share_token")
  .single();

if (error) throw error;

await db.from("story_images").insert(
  illustrated.map((p) => ({
    story_id: story.id,
    parent_id: USER_ID,
    page_index: p.index,
    image_url: p.imageUrl || cover || "",
    alt_text: p.title,
    prompt_used: p.image_prompt,
  })),
);

console.log("DONE", {
  storyId: story.id,
  share: story.share_token,
  pages: illustrated.length,
  cover,
  url: `http://127.0.0.1:5050/app/parent/stories/${story.id}`,
});
