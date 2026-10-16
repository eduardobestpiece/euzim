/**
 * Tenta aplicar supabase/schema.sql no projeto zlzgkivktvnyvehjwcjw.
 *
 * - PostgREST/secret key NÃO executa DDL.
 * - MCP Supabase desta sessão não tem permissão neste project_ref.
 * - Management API exige SUPABASE_ACCESS_TOKEN (personal), não a secret key do projeto.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-schema.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "zlzgkivktvnyvehjwcjw";
const FORBIDDEN = "hpjqetugksblfiojwhzh";

if (PROJECT_REF === FORBIDDEN) {
  console.error("Refusado: projeto Best Piece.");
  process.exit(1);
}

const schemaPath = resolve(process.cwd(), "supabase/schema.sql");
const sql = readFileSync(schemaPath, "utf8");
const token = process.env.SUPABASE_ACCESS_TOKEN;

console.log("Projeto alvo:", PROJECT_REF);
console.log("Schema bytes:", sql.length);

if (!token) {
  console.error(`
FALHA: sem SUPABASE_ACCESS_TOKEN (Management API).
A SUPABASE_SECRET_KEY autentica REST (evidência: GET /rest/v1/ → 200),
mas não executa DDL. Tabelas ainda ausentes (PGRST205).

Aplique manualmente no SQL Editor:
  https://supabase.com/dashboard/project/${PROJECT_REF}/sql
Arquivo: supabase/schema.sql
`);
  process.exit(2);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);

const body = await res.text();
console.log("Management API status:", res.status);
console.log(body.slice(0, 500));
process.exit(res.ok ? 0 : 1);
