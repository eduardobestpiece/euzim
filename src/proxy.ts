import { NextResponse, type NextRequest } from "next/server";
import { MOCK_SESSION_COOKIE } from "@/lib/auth/constants";
import type { ReferralChannel } from "@/lib/referral/constants";
import {
  REFERRAL_CHANNEL_COOKIE,
  REFERRAL_COOKIE,
  normalizeReferralCode,
  parseReferralChannel,
  referralCookieOptions,
} from "@/lib/referral/cookie";
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

function channelFromPath(
  pathname: string,
  explicit?: string | null,
): ReferralChannel {
  if (explicit) return parseReferralChannel(explicit);
  if (pathname.startsWith("/story/")) return "story";
  if (pathname.startsWith("/invite/")) return "friend_invite";
  if (pathname.startsWith("/r/")) return "app_share";
  return "other";
}

function setReferralCookies(
  response: NextResponse,
  code: string,
  channel: ReferralChannel,
) {
  response.cookies.set(REFERRAL_COOKIE, code, referralCookieOptions);
  response.cookies.set(REFERRAL_CHANNEL_COOKIE, channel, referralCookieOptions);
}

function copyResponseCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((c) => {
    to.cookies.set(c.name, c.value);
  });
}

/** Último clique: sobrescreve euzim_ref; /r/[code] → landing com gate. */
function applyReferralLastClick(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const url = request.nextUrl;
  const pathCode = url.pathname.startsWith("/r/")
    ? normalizeReferralCode(url.pathname.slice(3).split("/")[0] ?? "")
    : null;
  const queryCode = normalizeReferralCode(url.searchParams.get("ref"));
  const code = pathCode || queryCode;
  if (!code) return response;

  const channel = channelFromPath(url.pathname, url.searchParams.get("channel"));

  if (pathCode) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/";
    dest.searchParams.set("ref", code);
    dest.searchParams.set("channel", channel);
    const redirect = NextResponse.redirect(dest);
    copyResponseCookies(response, redirect);
    setReferralCookies(redirect, code, channel);
    return redirect;
  }

  setReferralCookies(response, code, channel);
  return response;
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

  // Referral last-click (antes dos redirects de auth)
  response = applyReferralLastClick(request, response);
  if (response.headers.get("location")) {
    return response;
  }

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isOnboarding = pathname.startsWith("/onboarding");
  const isPublicShare =
    pathname.startsWith("/story/") || pathname.startsWith("/app/story/");
  const isApp = pathname.startsWith("/app");

  if (!hasUser && isPublicShare) {
    // Share público: /app/story/* redireciona na page; /story/* é aberto
    return response;
  }

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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
