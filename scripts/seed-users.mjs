/**
 * Cria/atualiza usuários Auth Admin no projeto zlzgkivktvnyvehjwcjw.
 * Nunca Best Piece. Não imprime senhas.
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

const USERS = [
  {
    email: "contato@bpsales.com.br",
    password: "12345678",
    role: "admin",
    fullName: "Admin Estúdio Mágico",
  },
  {
    email: "eduardocosta@bpsales.com.br",
    password: "12345678",
    role: "parent",
    fullName: "Eduardo Costa",
  },
];

async function findUserByEmail(email) {
  const target = email.toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function upsertAuthUser(spec) {
  const existing = await findUserByEmail(spec.email);
  let userId;

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: spec.password,
      email_confirm: true,
      user_metadata: { full_name: spec.fullName, role: spec.role },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`updated auth ${spec.email} (${spec.role})`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: spec.email,
      password: spec.password,
      email_confirm: true,
      user_metadata: { full_name: spec.fullName, role: spec.role },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`created auth ${spec.email} (${spec.role})`);
  }

  const { error: upsertErr } = await admin.from("users").upsert(
    {
      id: userId,
      email: spec.email,
      full_name: spec.fullName,
      role: spec.role,
      onboarding_completed: true,
      subscription_plan_id: "family",
    },
    { onConflict: "id" },
  );
  if (upsertErr) throw upsertErr;
  console.log(`upserted public.users ${spec.email} role=${spec.role}`);

  // smoke login
  const anon = createClient(URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signed, error: signErr } = await anon.auth.signInWithPassword({
    email: spec.email,
    password: spec.password,
  });
  if (signErr || !signed.user) {
    console.error(`login FAIL ${spec.email}`, signErr?.message);
    process.exit(1);
  }
  console.log(`login OK ${spec.email} id=${signed.user.id.slice(0, 8)}…`);
  await anon.auth.signOut();
  return userId;
}

for (const spec of USERS) {
  await upsertAuthUser(spec);
}

console.log(JSON.stringify({ ok: true, count: USERS.length }, null, 2));
