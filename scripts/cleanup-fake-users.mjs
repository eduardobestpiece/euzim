/**
 * Apaga Auth + public.users exceto contato@ e eduardocosta@.
 * Projeto zlzgkivktvnyvehjwcjw only.
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

const KEEP = new Set([
  "contato@bpsales.com.br",
  "eduardocosta@bpsales.com.br",
]);
const REF = "zlzgkivktvnyvehjwcjw";
const URL = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;

if (!URL?.includes(REF) || !SECRET) {
  console.error("Projeto/secret inválidos");
  process.exit(1);
}

const admin = createClient(URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (error) throw error;

const toDelete = (data.users ?? []).filter(
  (u) => !KEEP.has((u.email || "").toLowerCase()),
);
console.log("Apagando", toDelete.map((u) => u.email));

for (const u of toDelete) {
  await admin.from("users").delete().eq("id", u.id);
  const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
  console.log(u.email, delErr ? delErr.message : "ok");
}
