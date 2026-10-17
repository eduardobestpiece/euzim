import { cookies } from "next/headers";
import {
  MOCK_ONBOARDING_COOKIE,
  MOCK_SESSION_COOKIE,
} from "@/lib/auth/constants";
import type { AuthUser, OnboardingState } from "@/lib/auth/types";
import { normalizeSecurityPin } from "@/lib/onboarding/pin-format";

export type MockSessionPayload = {
  id: string;
  email: string;
  role: "parent" | "admin";
  fullName?: string;
  onboardingCompleted: boolean;
};

/** Cookie de browser ~4096 chars — nunca guardar data URLs / listas grandes. */
const COOKIE_BUDGET = 3500;

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

/** Metadados de foto cabíveis no cookie (sem data URL / publicUrl longos). */
function lightPhotos(
  photos: OnboardingState["childPhotos"] | undefined,
): OnboardingState["childPhotos"] {
  if (!photos?.length) return [];
  return photos.map((p) => ({
    id: p.id || p.slotId,
    slotId: p.slotId,
    name: (p.name || p.slotId).slice(0, 48),
    previewUrl: "",
    storagePath: p.storagePath || "",
    // publicUrl omitido de propósito — reconstrói do Storage / DB
  }));
}

/**
 * Estado mínimo no cookie: perfil + passo + paths das fotos (sem previews).
 * Fonte da verdade das fotos: Supabase children.preferences.photo_paths.
 */
export function slimOnboardingForCookie(
  state: OnboardingState,
): OnboardingState {
  return {
    // Nunca gravar placeholder ("set") — o check do Postgres exige 4–6 dígitos
    securityPin: normalizeSecurityPin(state.securityPin) ?? "",
    child: state.child,
    friend: state.friend,
    childPhotos: lightPhotos(state.childPhotos),
    friendPhotos: lightPhotos(state.friendPhotos),
    childAvatarUrl: state.childAvatarUrl ?? null,
    friendAvatarUrl: state.friendAvatarUrl ?? null,
    wizardStep: state.wizardStep ?? "welcome",
    completed: Boolean(state.completed),
  };
}

export async function readMockSession(): Promise<MockSessionPayload | null> {
  const store = await cookies();
  return decode<MockSessionPayload>(store.get(MOCK_SESSION_COOKIE)?.value);
}

export async function writeMockSession(session: MockSessionPayload) {
  const store = await cookies();
  store.set(MOCK_SESSION_COOKIE, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearMockSession() {
  const store = await cookies();
  store.delete(MOCK_SESSION_COOKIE);
  store.delete(MOCK_ONBOARDING_COOKIE);
}

export async function readMockOnboarding(): Promise<OnboardingState | null> {
  const store = await cookies();
  return decode<OnboardingState>(store.get(MOCK_ONBOARDING_COOKIE)?.value);
}

export async function writeMockOnboarding(state: OnboardingState) {
  const store = await cookies();
  let slim = slimOnboardingForCookie(state);
  let encoded = encode(slim);

  // Se ainda passar do budget (nome longo etc.), corta avatares URLs
  if (encoded.length > COOKIE_BUDGET) {
    slim = {
      ...slim,
      childAvatarUrl: slim.childAvatarUrl ? "1" : null,
      friendAvatarUrl: slim.friendAvatarUrl ? "1" : null,
    };
    encoded = encode(slim);
  }

  if (encoded.length > COOKIE_BUDGET) {
    // Último recurso: só passo + PIN real (4–6 chars) + flags — sem fotos/URLs
    encoded = encode({
      securityPin: normalizeSecurityPin(slim.securityPin) ?? "",
      child: slim.child
        ? {
            displayName: slim.child.displayName.slice(0, 40),
            birthDate: slim.child.birthDate,
            gender: slim.child.gender,
          }
        : null,
      friend: slim.friend
        ? {
            kind: slim.friend.kind,
            displayName: slim.friend.displayName.slice(0, 40),
          }
        : null,
      childPhotos: [],
      friendPhotos: [],
      childAvatarUrl: null,
      friendAvatarUrl: null,
      wizardStep: slim.wizardStep,
      completed: slim.completed,
    });
  }

  store.set(MOCK_ONBOARDING_COOKIE, encoded, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export function mockSessionToUser(session: MockSessionPayload): AuthUser {
  return {
    id: session.id,
    email: session.email,
    role: session.role,
    fullName: session.fullName ?? null,
    onboardingCompleted: session.onboardingCompleted,
    isMock: true,
  };
}

export function createMockUserId(): string {
  return crypto.randomUUID();
}
