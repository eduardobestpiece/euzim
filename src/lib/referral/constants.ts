/** Cookie e canais do programa de indicação (último clique). */

export const REFERRAL_COOKIE = "euzim_ref";
export const REFERRAL_CHANNEL_COOKIE = "euzim_ref_channel";
/** ~60 dias */
export const REFERRAL_COOKIE_MAX_AGE = 60 * 24 * 60 * 60;

export type ReferralChannel =
  | "story"
  | "friend_invite"
  | "app_share"
  | "other";

export type GiftOptionId =
  | "stories_2"
  | "avatar_1"
  | "stories_4"
  | "avatars_2"
  | "avatar_1_stories_2";

export type GiftOption = {
  id: GiftOptionId;
  label: string;
  stories: number;
  avatars: number;
};

export const STARTER_GIFT_OPTIONS: GiftOption[] = [
  { id: "stories_2", label: "2 histórias extras", stories: 2, avatars: 0 },
  { id: "avatar_1", label: "1 avatar extra", stories: 0, avatars: 1 },
];

export const FAMILY_GIFT_OPTIONS: GiftOption[] = [
  { id: "stories_4", label: "4 histórias extras", stories: 4, avatars: 0 },
  { id: "avatars_2", label: "2 avatares extras", stories: 0, avatars: 2 },
  {
    id: "avatar_1_stories_2",
    label: "1 avatar + 2 histórias",
    stories: 2,
    avatars: 1,
  },
];

export function giftOptionsForPlan(planId: string): GiftOption[] {
  if (planId === "starter") return STARTER_GIFT_OPTIONS;
  if (planId === "family" || planId === "plus") return FAMILY_GIFT_OPTIONS;
  return [];
}
