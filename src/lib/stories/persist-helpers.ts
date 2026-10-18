/**
 * Persistência resiliente ao schema live do Euzim
 * (`visibility` pode ainda não existir até o SQL social).
 */

type DbError = {
  code?: string;
  message?: string;
  details?: string;
} | null;

export function isMissingStoryColumnError(error: DbError): boolean {
  if (!error) return false;
  const blob = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column|does not exist|schema cache|visibility|is_public/i.test(blob)
  );
}

export type StoryInsertRow = {
  id: string;
  share_token?: string | null;
};

/**
 * Insere em `stories` com visibility/is_public; se a coluna não existir,
 * tenta de novo sem esses campos (evita cair no mock por schema atrasado).
 */
export async function insertStoryResilient(
  // Cliente Supabase (admin ou user) - tipagem frouxa de propósito
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  payload: Record<string, unknown>,
  selectCols = "id, share_token",
): Promise<{ data: StoryInsertRow | null; error: DbError }> {
  const withSocial: Record<string, unknown> = {
    ...payload,
    visibility: payload.visibility ?? "private",
    is_public: payload.is_public ?? false,
  };

  let result = await db
    .from("stories")
    .insert(withSocial)
    .select(selectCols)
    .single();

  if (result.error && isMissingStoryColumnError(result.error)) {
    const stripped = { ...payload };
    delete stripped.visibility;
    delete stripped.is_public;
    result = await db
      .from("stories")
      .insert(stripped)
      .select(selectCols)
      .single();
  }

  return {
    data: (result.data as StoryInsertRow | null) ?? null,
    error: (result.error as DbError) ?? null,
  };
}
