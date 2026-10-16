import { NextResponse, type NextRequest } from "next/server";
import { MOCK_SESSION_COOKIE } from "@/lib/auth/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

function decodeMockSession(raw: string | undefined): {
  onboardingCompleted: boolean;
  role: string;
} | null {
  if (!raw) return null;
  try {
    return JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as { onboardingCompleted: boolean; role: string };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response: NextResponse;
  let hasUser = false;
  let onboardingCompleted = false;
  let role = "parent";

  if (isSupabaseConfigured()) {
    const result = await updateSupabaseSession(request);
    response = result.response;
    hasUser = Boolean(result.user);
    // Perfil completo é validado nas páginas; no proxy só sessão.
  } else {
    response = NextResponse.next({ request: { headers: request.headers } });
    const mock = decodeMockSession(
      request.cookies.get(MOCK_SESSION_COOKIE)?.value,
    );
    hasUser = Boolean(mock);
    onboardingCompleted = Boolean(mock?.onboardingCompleted);
    role = mock?.role ?? "parent";
  }

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isOnboarding = pathname.startsWith("/onboarding");
  const isApp = pathname.startsWith("/app");

  if (!hasUser && (isApp || isOnboarding)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hasUser && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = onboardingCompleted || isSupabaseConfigured()
      ? "/app/parent"
      : "/onboarding";
    return NextResponse.redirect(url);
  }

  if (
    hasUser &&
    !isSupabaseConfigured() &&
    !onboardingCompleted &&
    isApp
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  if (
    hasUser &&
    !isSupabaseConfigured() &&
    onboardingCompleted &&
    isOnboarding
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/parent";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/app/admin") && role !== "admin" && hasUser) {
    if (!isSupabaseConfigured()) {
      const url = request.nextUrl.clone();
      url.pathname = "/app/parent";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
