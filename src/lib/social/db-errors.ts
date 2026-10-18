/** Erros de schema social (migration ainda não aplicada no Euzim). */
export function isMissingSocialTableError(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    (m.includes("friendships") ||
      m.includes("friend_invites") ||
      m.includes("story_likes") ||
      m.includes("visibility")) &&
    (m.includes("schema cache") ||
      m.includes("does not exist") ||
      m.includes("could not find") ||
      m.includes("42703") ||
      m.includes("pgrst205"))
  );
}

export function friendlySocialDbError(message: string | undefined): string {
  if (isMissingSocialTableError(message)) {
    return "A área Social ainda precisa da migration no projeto Euzim (tabelas de amizade). Peça para aplicar docs/area-social-migration.sql no SQL Editor (só zlzgkivktvnyvehjwcjw).";
  }
  return message?.trim() || "Não foi possível concluir. Tente de novo.";
}
