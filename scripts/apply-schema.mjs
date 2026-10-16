/**
 * Aplica supabase/schema.sql no projeto zlzgkivktvnyvehjwcjw.
 *
 * Caminhos tentados:
 * 1) Management API com SUPABASE_ACCESS_TOKEN (pessoal) — único que faz DDL
 * 2) Evidência REST com SUPABASE_SECRET_KEY (não executa DDL)
 *
 * Nunca usa hpjqetugksblfiojwhzh (Best Piece).
 *
 * Uso:
 *   set -a && source .env.local && set +a
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-schema.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "zlzgkivktvnyvehjwcjw";
const FORBIDDEN = "hpjqetugksblfiojwhzh";
const BASE = `https://${PROJECT_REF}.supabase.co`;

if (PROJECT_REF === FORBIDDEN) {
  console.error("Refusado: projeto Best Piece.");
  process.exit(1);
}

const schemaPath = resolve(process.cwd(), "supabase/schema.sql");
const sql = readFileSync(schemaPath, "utf8");
const secret = process.env.SUPABASE_SECRET_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

console.log("Projeto alvo:", PROJECT_REF);
console.log("Schema bytes:", sql.length);
console.log("Has secret:", Boolean(secret));
console.log("Has access token:", Boolean(accessToken));

async function probeRest() {
  if (!secret) return { rest: null, tables: {} };
  const rest = await fetch(`${BASE}/rest/v1/`, {
    headers: { apikey: secret, Authorization: `Bearer ${secret}` },
  });
  const tables = {};
  for (const t of [
    "users",
    "children",
    "characters",
    "story_templates",
    "stories",
    "story_images",
    "games",
    "subscription_limits",
  ]) {
    const r = await fetch(`${BASE}/rest/v1/${t}?select=id&limit=1`, {
      headers: { apikey: secret, Authorization: `Bearer ${secret}` },
    });
    tables[t] = r.status;
  }
  return { rest: rest.status, tables };
}

const probe = await probeRest();
console.log("REST secret status:", probe.rest);
console.log("Tables probe:", probe.tables);

if (accessToken) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const body = await res.text();
  console.log("Management query status:", res.status);
  console.log(body.slice(0, 800));

  if (res.ok) {
    const after = await probeRest();
    console.log("Tables after apply:", after.tables);
    process.exit(0);
  }
  process.exit(1);
}

console.error(`
FALHA DDL: SUPABASE_SECRET_KEY autentica REST (status ${probe.rest}) mas NÃO executa SQL.
Tabelas ausentes (404/PGRST205): ${Object.entries(probe.tables)
  .filter(([, s]) => s !== 200)
  .map(([t]) => t)
  .join(", ")}

O que JÁ funciona via API com secret/publishable:
- Auth signup/login (GoTrue)
- Storage buckets (criados: avatars, story-images)
- REST introspection

Para aplicar o schema:
1) SQL Editor: https://supabase.com/dashboard/project/${PROJECT_REF}/sql
   Arquivo: supabase/schema.sql
2) Ou: SUPABASE_ACCESS_TOKEN=<personal> node scripts/apply-schema.mjs
`);
process.exit(2);
