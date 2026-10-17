import { createHash } from "node:crypto";

/** Normaliza prompt removendo nomes próprios variáveis para cache cross-story. */
export function normalizePromptForHash(
  prompt: string,
  names: string[],
): string {
  let out = prompt.toLowerCase().replace(/\s+/g, " ").trim();
  for (const name of names) {
    const n = name.trim();
    if (n.length < 2) continue;
    out = out.replace(new RegExp(escapeReg(n), "gi"), "[name]");
  }
  return out;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hashPrompt(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}
