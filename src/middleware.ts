import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy";
import {
  REFERRAL_CHANNEL_COOKIE,
  REFERRAL_COOKIE,
  normalizeReferralCode,
  parseReferralChannel,
  referralCookieOptions,
} from "@/lib/referral/cookie";
import type { ReferralChannel } from "@/lib/referral/constants";

function channelFromPath(pathname: string, explicit?: string | null): ReferralChannel {
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

export async function middleware(request: NextRequest) {
  const { response } = await updateSupabaseSession(request);

  const url = request.nextUrl;
  const pathCode =
    url.pathname.startsWith("/r/")
      ? normalizeReferralCode(url.pathname.slice(3).split("/")[0] ?? "")
      : null;
  const queryCode = normalizeReferralCode(url.searchParams.get("ref"));
  const code = pathCode || queryCode;

  if (code) {
    const channel = channelFromPath(
      url.pathname,
      url.searchParams.get("channel"),
    );
    setReferralCookies(response, code, channel);

    // /r/[code] → landing com gate de cadastro
    if (pathCode) {
      const dest = request.nextUrl.clone();
      dest.pathname = "/";
      dest.searchParams.set("ref", code);
      dest.searchParams.set("channel", channel);
      const redirect = NextResponse.redirect(dest);
      setReferralCookies(redirect, code, channel);
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
