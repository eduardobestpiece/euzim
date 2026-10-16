import type { ChildGender } from "@/lib/onboarding/child-profile";

export type AppRole = "parent" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  role: AppRole;
  fullName?: string | null;
  onboardingCompleted: boolean;
  isMock: boolean;
};

export type OnboardingChildDraft = {
  displayName: string;
  birthDate: string;
  gender: ChildGender;
  /** Derivado na UI — não é fonte de verdade */
  ageYears?: number;
};

export type FriendKind = "pet" | "toy";

export type OnboardingFriendDraft = {
  kind: FriendKind;
  displayName: string;
};

export type OnboardingPhotoDraft = {
  id: string;
  slotId: string;
  name: string;
  /** data URL local (preview) */
  previewUrl: string;
  storagePath: string;
  publicUrl?: string;
};

export type OnboardingState = {
  securityPin: string;
  child: OnboardingChildDraft | null;
  childPhotos: OnboardingPhotoDraft[];
  friend: OnboardingFriendDraft | null;
  friendPhotos: OnboardingPhotoDraft[];
  childAvatarUrl?: string | null;
  friendAvatarUrl?: string | null;
  /** @deprecated legado — preferir childPhotos */
  photos?: OnboardingPhotoDraft[];
  completed: boolean;
};
