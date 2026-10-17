import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  readMockOnboarding,
  writeMockOnboarding,
} from "@/lib/auth/mock-session";

const STEPS = new Set([
  "welcome",
  "child",
  "child-photos",
  "friend",
  "friend-photos",
  "generating",
  "preview",
  "pin",
]);

/** Persiste passo sem estourar cookie (só DB + slim cookie). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }

  let step = "";
  try {
    const body = (await request.json()) as { step?: string };
    step = String(body.step ?? "");
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!STEPS.has(step)) {
    return NextResponse.json({ error: "Passo inválido." }, { status: 400 });
  }

  try {
    const state = (await readMockOnboarding()) ?? {
      securityPin: "",
      child: null,
      childPhotos: [],
      friend: null,
      friendPhotos: [],
      completed: false,
    };
    state.wizardStep = step;
    await writeMockOnboarding(state);
  } catch {
    // Cookie pode falhar — DB abaixo ainda salva
  }

  if (isSupabaseConfigured() && !user.isMock) {
    const db = createAdminClient() ?? (await createClient());
    if (db) {
      const { data: children } = await db
        .from("children")
        .select("id, preferences")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      const child = children?.[0];
      if (child?.id) {
        const prefs =
          child.preferences && typeof child.preferences === "object"
            ? { ...(child.preferences as Record<string, unknown>) }
            : {};
        prefs.onboarding_wizard_step = step;
        await db
          .from("children")
          .update({ preferences: prefs })
          .eq("id", child.id);
      }
    }
  }

  return NextResponse.json({ success: true, step });
}
