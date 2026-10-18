import {
  REFERRAL_CHANNEL_COOKIE,
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE,
  type ReferralChannel,
} from "@/lib/referral/constants";

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (code.length < 4 || code.length > 16) return null;
  return code;
}

export function parseReferralChannel(
  raw: string | null | undefined,
): ReferralChannel {
  if (
    raw === "story" ||
    raw === "friend_invite" ||
    raw === "app_share" ||
    raw === "other"
  ) {
    return raw;
  }
  return "other";
}

export const referralCookieOptions = {
  path: "/",
  maxAge: REFERRAL_COOKIE_MAX_AGE,
  sameSite: "lax" as const,
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
};

export { REFERRAL_COOKIE, REFERRAL_CHANNEL_COOKIE };
