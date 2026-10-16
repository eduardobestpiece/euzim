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
  birthDate?: string;
};

export type OnboardingPhotoDraft = {
  id: string;
  name: string;
  /** data URL local (mock) ou path futuro no Storage */
  previewUrl: string;
  storagePath: string;
};

export type OnboardingState = {
  securityPin: string;
  child: OnboardingChildDraft | null;
  photos: OnboardingPhotoDraft[];
  completed: boolean;
};
