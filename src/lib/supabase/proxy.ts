import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  if (!isSupabaseConfigured()) {
    return { response, user: null as { id: string } | null };
  }

  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // getSession lê o JWT do cookie (rápido). getUser() bate no Auth (~5s+) e
  // satura o proxy em HMR/login — páginas sensíveis revalidam com getUser.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return { response, user: session?.user ?? null };
}
