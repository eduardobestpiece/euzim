/**
 * Smoke ponta a ponta em zlzgkivktvnyvehjwcjw (nunca Best Piece).
 * Cria user auth → users/children → story + images + game → verifica REST.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

loadEnv();

const URL = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const REF = "zlzgkivktvnyvehjwcjw";

if (!URL?.includes(REF) || URL.includes("hpjqetugksblfiojwhzh")) {
  console.error("Projeto inválido / isolação");
  process.exit(1);
}
if (!SECRET) {
  console.error("Falta SUPABASE_SECRET_KEY");
  process.exit(1);
}

const admin = createClient(URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stamp = Date.now();
const email = `smoke.fase6.${stamp}@gmail.com`;
const password = `SmokePass${stamp}!`;

console.log("1) createUser", email);
const { data: created, error: userErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Smoke Parent" },
});
if (userErr || !created.user) {
  console.error(userErr);
  process.exit(1);
}
const parentId = created.user.id;
console.log("   parentId", parentId);

console.log("2) upsert users + children");
await admin.from("users").upsert({
  id: parentId,
  email,
  full_name: "Smoke Parent",
  role: "parent",
  onboarding_completed: true,
  security_pin: "1234",
  subscription_plan_id: "family",
});

const { data: child, error: childErr } = await admin
  .from("children")
  .insert({ parent_id: parentId, display_name: "Luna" })
  .select("id")
  .single();
if (childErr) {
  console.error(childErr);
  process.exit(1);
}

const textContent = {
  pages: [
    { index: 0, text: "Luna encontrou um mapa brilhante." },
    { index: 1, text: "Ela atravessou a floresta encantada." },
    { index: 2, text: "Um amigo gentil apareceu no caminho." },
    { index: 3, text: "Juntas resolveram o desafio com carinho." },
  ],
};

const cover =
  "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80";

console.log("3) insert story + images");
const { data: story, error: storyErr } = await admin
  .from("stories")
  .insert({
    parent_id: parentId,
    child_id: child.id,
    title: "Luna e a floresta encantada",
    status: "ready",
    is_public: true,
    text_content: textContent,
    cover_image_url: cover,
    generation_meta: { engine: "smoke" },
    published_at: new Date().toISOString(),
  })
  .select("id, share_token")
  .single();
if (storyErr) {
  console.error(storyErr);
  process.exit(1);
}

const images = textContent.pages.map((p) => ({
  story_id: story.id,
  parent_id: parentId,
  page_index: p.index,
  image_url: cover,
  alt_text: `Página ${p.index + 1}`,
}));
const { error: imgErr } = await admin.from("story_images").insert(images);
if (imgErr) {
  console.error(imgErr);
  process.exit(1);
}

console.log("4) insert game quiz");
const { error: gameErr } = await admin.from("games").insert({
  story_id: story.id,
  parent_id: parentId,
  child_id: child.id,
  game_type: "quiz",
  title: "Quiz — Luna",
  questions_data: [{ id: "q1", prompt: "Quem é a estrela?", correctIndex: 0 }],
  score_best: 1,
});
if (gameErr) {
  console.error(gameErr);
  process.exit(1);
}

console.log("5) REST verify");
for (const [path, label] of [
  [`/rest/v1/stories?id=eq.${story.id}&select=id,share_token,is_public`, "story"],
  [`/rest/v1/story_images?story_id=eq.${story.id}&select=page_index`, "images"],
  [`/rest/v1/games?story_id=eq.${story.id}&select=id,score_best`, "games"],
  [
    `/rest/v1/subscription_limits?plan_id=eq.family&select=max_stories_per_month`,
    "limits",
  ],
]) {
  const res = await fetch(`${URL}${path}`, {
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
  });
  const body = await res.text();
  console.log(`   ${label} ${res.status}`, body.slice(0, 120));
}

console.log("6) public share_token", story.share_token);
const pub = await fetch(
  `${URL}/rest/v1/stories?share_token=eq.${story.share_token}&is_public=eq.true&select=id,title`,
  {
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_PUBLISHABLE_KEY}`,
    },
  },
);
console.log("   anon share", pub.status, (await pub.text()).slice(0, 160));

console.log(
  JSON.stringify(
    {
      ok: true,
      storyId: story.id,
      shareToken: story.share_token,
      sharePath: `/story/${story.share_token}`,
      kidsPath: `/app/kids/read/${story.id}`,
    },
    null,
    2,
  ),
);
