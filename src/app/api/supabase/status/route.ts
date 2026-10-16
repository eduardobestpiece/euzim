import { createSupabaseContext } from "@supabase/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Health da API Supabase (projeto zlzgkivktvnyvehjwcjw) usando @supabase/server.
 * Aceita Authorization/apikey com secret ou publishable.
 */
export async function GET(request: Request) {
  const { data: ctx, error } = await createSupabaseContext(request, {
    auth: ["secret", "publishable", "none"],
  });

  const admin = createAdminClient();
  let buckets: string[] = [];
  let storiesTable: "ok" | "missing" | "error" = "error";

  if (admin) {
    const listed = await admin.storage.listBuckets();
    buckets = listed.data?.map((b) => b.name) ?? [];
    const { error: storiesError } = await admin
      .from("stories")
      .select("id")
      .limit(1);
    if (!storiesError) storiesTable = "ok";
    else if (storiesError.code === "PGRST205" || storiesError.message?.includes("Could not find")) {
      storiesTable = "missing";
    }
  }

  return NextResponse.json(
    {
      ok: true,
      projectRef: "zlzgkivktvnyvehjwcjw",
      contextAuthMode: ctx?.authMode ?? null,
      contextError: error
        ? { message: error.message, code: (error as { code?: string }).code }
        : null,
      hasAdminClient: Boolean(admin),
      storageBuckets: buckets,
      storiesTable,
      note:
        storiesTable === "missing"
          ? "Schema ainda não aplicado — cole supabase/schema.sql no SQL Editor."
          : undefined,
    },
    { status: 200 },
  );
}
