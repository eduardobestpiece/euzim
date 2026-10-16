import { cookies } from "next/headers";
import {
  MOCK_ONBOARDING_COOKIE,
  MOCK_SESSION_COOKIE,
} from "@/lib/auth/constants";
import type { AuthUser, OnboardingState } from "@/lib/auth/types";

export type MockSessionPayload = {
  id: string;
  email: string;
  role: "parent" | "admin";
  fullName?: string;
  onboardingCompleted: boolean;
};

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
  store.set(MOCK_ONBOARDING_COOKIE, encode(state), {
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
