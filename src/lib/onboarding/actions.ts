"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  readMockOnboarding,
  readMockSession,
  writeMockOnboarding,
  writeMockSession,
} from "@/lib/auth/mock-session";
import type {
  FriendKind,
  OnboardingFriendDraft,
  OnboardingPhotoDraft,
  OnboardingState,
} from "@/lib/auth/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateAvatarPreview } from "@/lib/onboarding/avatar-preview";
import {
  slotsForSubject,
  requiredPhotoCount,
  missingSlotIds,
  type PhotoSubject,
} from "@/lib/onboarding/photo-slots";
import {
  draftsFromStoredPaths,
  preferenceKeyForSubject,
  storedPathsFromDrafts,
  type StoredPhotoPath,
} from "@/lib/onboarding/photo-persistence";
import {
  ageYearsFromBirthDate,
  nextAvatarRefreshDue,
  validateBirthDate,
  type ChildGender,
} from "@/lib/onboarding/child-profile";

export type OnboardingActionResult = {
  error?: string;
  success?: boolean;
  childAvatarUrl?: string;
  friendAvatarUrl?: string;
  engine?: string;
};

function emptyState(): OnboardingState {
  return {
    securityPin: "",
    child: null,
    childPhotos: [],
    friend: null,
    friendPhotos: [],
    wizardStep: "welcome",
    completed: false,
  };
}

const WIZARD_STEPS = new Set([
  "welcome",
  "child",
  "child-photos",
  "friend",
  "friend-photos",
  "generating",
  "preview",
  "pin",
]);

/** Persiste o passo atual (cookie) para retomar de onde parou. */
export async function saveWizardStepAction(
  step: string,
): Promise<OnboardingActionResult> {
  if (!WIZARD_STEPS.has(step)) return { error: "Passo inválido." };
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };

  const state = await loadState();
  state.wizardStep = step;
  await writeMockOnboarding(state);

  // Também grava em children.preferences quando houver filho
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
            ? (child.preferences as Record<string, unknown>)
            : {};
        await db
          .from("children")
          .update({
            preferences: { ...prefs, onboarding_wizard_step: step },
          })
          .eq("id", child.id);
      }
    }
  }

  return { success: true };
}

function photosBySlot(
  photos: OnboardingPhotoDraft[],
): Record<string, OnboardingPhotoDraft> {
  const map: Record<string, OnboardingPhotoDraft> = {};
  for (const p of photos) {
    if (p.slotId) map[p.slotId] = p;
  }
  return map;
}

function assertCompletePhotos(
  photos: OnboardingPhotoDraft[],
  subject: PhotoSubject,
): string | null {
  const bySlot = photosBySlot(photos);
  const missing = missingSlotIds(bySlot, subject);
  const slots = slotsForSubject(subject);
  const required = requiredPhotoCount(subject);
  if (missing.length) {
    const labels = missing
      .map((id) => {
        const slot = slots.find((s) => s.id === id);
        if (!slot) return id;
        return subject === "friend" ? slot.labelFriend : slot.labelChild;
      })
      .slice(0, 4);
    return `Faltam ${missing.length} foto(s): ${labels.join(", ")}${missing.length > 4 ? "…" : ""}`;
  }
  if (Object.keys(bySlot).length < required) {
    return `Envie as ${required} fotos guiadas.`;
  }
  return null;
}

async function loadChildPreferences(userId: string): Promise<{
  childId: string | null;
  preferences: Record<string, unknown>;
  displayName?: string;
  birthDate?: string | null;
  gender?: string | null;
  avatarUrl?: string | null;
} | null> {
  const db = createAdminClient() ?? (await createClient());
  if (!db) return null;
  const { data: children } = await db
    .from("children")
    .select("id, display_name, birth_date, gender, avatar_url, preferences")
    .eq("parent_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  const child = children?.[0];
  if (!child) return null;
  const preferences =
    child.preferences && typeof child.preferences === "object"
      ? (child.preferences as Record<string, unknown>)
      : {};
  return {
    childId: child.id,
    preferences,
    displayName: child.display_name,
    birthDate: child.birth_date,
    gender: child.gender,
    avatarUrl: child.avatar_url,
  };
}

/** Cookie + hidratação das fotos salvas no banco (fonte da verdade). */
async function loadState(): Promise<OnboardingState> {
  const cookie = (await readMockOnboarding()) ?? emptyState();
  const user = await getCurrentUser();
  if (!user || !isSupabaseConfigured() || user.isMock) {
    return cookie;
  }

  const row = await loadChildPreferences(user.id);
  if (!row) return cookie;

  const state: OnboardingState = { ...cookie };

  if (!state.child?.displayName && row.displayName) {
    const gender =
      row.gender === "boy" || row.gender === "girl" || row.gender === "other"
        ? row.gender
        : "other";
    state.child = {
      displayName: row.displayName,
      birthDate: row.birthDate || "",
      gender,
      ageYears: ageYearsFromBirthDate(row.birthDate || "") ?? undefined,
    };
  }

  const childPaths = row.preferences.photo_paths as StoredPhotoPath[] | undefined;
  const friendPaths = row.preferences.friend_photo_paths as
    | StoredPhotoPath[]
    | undefined;
  const dbChildPhotos = draftsFromStoredPaths(childPaths);
  const dbFriendPhotos = draftsFromStoredPaths(friendPaths);

  if (dbChildPhotos.length >= (state.childPhotos?.length ?? 0)) {
    state.childPhotos = dbChildPhotos;
  }
  if (dbFriendPhotos.length >= (state.friendPhotos?.length ?? 0)) {
    state.friendPhotos = dbFriendPhotos;
  }

  if (!state.childAvatarUrl && row.avatarUrl) {
    state.childAvatarUrl = row.avatarUrl;
  }

  const friendMeta = row.preferences.friend as
    | { kind?: string; displayName?: string }
    | undefined;
  if (!state.friend?.displayName && friendMeta?.displayName) {
    state.friend = {
      kind: friendMeta.kind === "toy" ? "toy" : "pet",
      displayName: friendMeta.displayName,
    };
  }

  const step = row.preferences.onboarding_wizard_step;
  if (typeof step === "string" && step && !state.wizardStep) {
    state.wizardStep = step;
  }

  return state;
}

export async function saveOnboardingPinAction(
  _prev: OnboardingActionResult,
  formData: FormData,
): Promise<OnboardingActionResult> {
  const pin = String(formData.get("pin") ?? "").trim();
  const confirm = String(formData.get("confirmPin") ?? "").trim();
  if (!/^\d{4,6}$/.test(pin)) {
    return { error: "O PIN deve ter 4 a 6 dígitos." };
  }
  if (pin !== confirm) return { error: "Os PINs não coincidem." };

  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };

  const state = await loadState();
  state.securityPin = pin;
  await writeMockOnboarding(state);

  if (isSupabaseConfigured() && !user.isMock) {
    const db = createAdminClient() ?? (await createClient());
    if (db) {
      await db.from("users").upsert({
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        role: user.role,
        security_pin: pin,
        onboarding_completed: false,
      });
    }
  }

  return { success: true };
}

export async function saveChildAvatarProfileAction(
  _prev: OnboardingActionResult,
  formData: FormData,
): Promise<OnboardingActionResult> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "").trim();
  const genderRaw = String(formData.get("gender") ?? "").trim();
  const gender: ChildGender | null =
    genderRaw === "boy" || genderRaw === "girl" || genderRaw === "other"
      ? genderRaw
      : null;

  if (!displayName || displayName.length > 80) {
    return { error: "Informe o nome da criança (até 80 caracteres)." };
  }
  if (!gender) {
    return { error: "Selecione o gênero (Menino, Menina ou Prefiro não dizer)." };
  }

  const birthError = validateBirthDate(birthDate);
  if (birthError) return { error: birthError };
  const ageYears = ageYearsFromBirthDate(birthDate) ?? undefined;

  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };

  const state = await loadState();
  state.child = { displayName, birthDate, gender, ageYears };
  await writeMockOnboarding(state);

  if (isSupabaseConfigured() && !user.isMock) {
    const db = createAdminClient() ?? (await createClient());
    if (db) {
      await db.from("users").upsert({
        id: user.id,
        email: user.email,
        role: user.role,
        onboarding_completed: false,
      });

      const { data: existing } = await db
        .from("children")
        .select("id")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      const payload = {
        display_name: displayName,
        birth_date: birthDate,
        gender,
        preferences: { age_years: ageYears ?? null },
      };

      if (existing?.[0]?.id) {
        await db.from("children").update(payload).eq("id", existing[0].id);
      } else {
        await db.from("children").insert({
          parent_id: user.id,
          ...payload,
        });
      }
    }
  }

  return { success: true };
}

export async function saveFriendProfileAction(
  _prev: OnboardingActionResult,
  formData: FormData,
): Promise<OnboardingActionResult> {
  const kind = String(formData.get("kind") ?? "") as FriendKind;
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (kind !== "pet" && kind !== "toy") {
    return { error: "Escolha pet ou brinquedo favorito." };
  }
  if (!displayName || displayName.length > 80) {
    return { error: "Informe o nome do melhor amigo." };
  }

  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };

  const friend: OnboardingFriendDraft = { kind, displayName };
  const state = await loadState();
  state.friend = friend;
  await writeMockOnboarding(state);

  if (isSupabaseConfigured() && !user.isMock) {
    const db = createAdminClient() ?? (await createClient());
    if (db) {
      const row = await loadChildPreferences(user.id);
      if (row?.childId) {
        const prefs = { ...row.preferences, friend: { kind, displayName } };
        await db
          .from("children")
          .update({ preferences: prefs })
          .eq("id", row.childId);
      }
    }
  }

  return { success: true };
}

/** Persiste fotos no banco (preferences) + cookie enxuto (só paths). */
export async function saveSubjectPhotosAction(input: {
  subject: "child" | "friend";
  photos: OnboardingPhotoDraft[];
  allowPartial?: boolean;
}): Promise<OnboardingActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };

  if (!input.allowPartial) {
    const missing = assertCompletePhotos(input.photos, input.subject);
    if (missing) return { error: missing };
  } else if (input.photos.length < 1) {
    return { error: "Nenhuma foto para salvar." };
  }

  const state = await loadState();
  const light = input.photos.map((p) => ({
    id: p.id,
    slotId: p.slotId,
    name: p.name,
    previewUrl: "",
    storagePath: p.storagePath,
    publicUrl: p.publicUrl,
  }));

  if (input.subject === "child") {
    state.childPhotos = light;
  } else {
    state.friendPhotos = light;
  }
  await writeMockOnboarding(state);

  if (isSupabaseConfigured() && !user.isMock) {
    const db = createAdminClient() ?? (await createClient());
    if (db) {
      const row = await loadChildPreferences(user.id);
      const childId = row?.childId;
      if (childId) {
        const prefs = { ...(row?.preferences ?? {}) };
        const key = preferenceKeyForSubject(input.subject);
        prefs[key] = storedPathsFromDrafts(input.photos);
        prefs.age_years = state.child?.ageYears ?? prefs.age_years ?? null;
        prefs.gender = state.child?.gender ?? prefs.gender ?? null;
        if (state.friend) {
          prefs.friend = {
            kind: state.friend.kind,
            displayName: state.friend.displayName,
          };
        }

        const patch: Record<string, unknown> = {
          preferences: prefs,
        };

        if (input.subject === "child") {
          const cover =
            input.photos.find((p) => p.slotId === "face-front")?.publicUrl ||
            input.photos[0]?.publicUrl ||
            null;
          if (cover) patch.avatar_url = cover;
          if (!input.allowPartial) {
            const capturedAt = new Date();
            patch.avatar_photos_captured_at = capturedAt.toISOString();
            patch.avatar_refresh_due_at =
              nextAvatarRefreshDue(capturedAt).toISOString();
          }
        }

        const { error } = await db
          .from("children")
          .update(patch)
          .eq("id", childId);
        if (error) {
          return { error: `Não foi possível salvar as fotos: ${error.message}` };
        }
      } else {
        return {
          error:
            "Perfil da criança não encontrado no banco. Volte e salve o nome/idade.",
        };
      }
    }
  }

  return { success: true };
}

export async function uploadAvatarPhotoAction(formData: FormData): Promise<{
  error?: string;
  storagePath?: string;
  publicUrl?: string;
  previewUrl?: string;
  slotId?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };

  const slotId = String(formData.get("slotId") ?? "");
  const subject = String(formData.get("subject") ?? "child");
  const file = formData.get("file");
  if (!slotId || !(file instanceof File)) {
    return { error: "Arquivo ou slot inválido." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "Envie uma imagem." };
  }

  // Limite de segurança (cliente já comprime; config bodySizeLimit = 12mb)
  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return {
      error:
        "A foto ultrapassa 10 MB. Escolha outra imagem ou tire novamente.",
    };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext)
    ? ext === "jpeg"
      ? "jpg"
      : ext
    : "jpg";
  const storagePath = `${user.id}/${subject}/${slotId}.${safeExt}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  // Não devolver data URL base64 — estoura a resposta e o limite da action.
  // O cliente usa preview local (object URL / data URL) até ter publicUrl.

  if (!isSupabaseConfigured() || user.isMock) {
    return {
      storagePath: `mock/avatars/${storagePath}`,
      publicUrl: undefined,
      previewUrl: undefined,
      slotId,
    };
  }

  const db = createAdminClient() ?? (await createClient());
  if (!db) return { error: "Supabase indisponível." };

  const contentType =
    file.type && file.type.startsWith("image/")
      ? file.type
      : "image/jpeg";

  const { error: upErr } = await db.storage
    .from("avatars")
    .upload(storagePath, bytes, {
      contentType,
      upsert: true,
    });

  if (upErr) {
    // Continua com path local se storage falhar — preview fica no cliente
    return {
      storagePath: `local/${storagePath}`,
      publicUrl: undefined,
      previewUrl: undefined,
      slotId,
    };
  }

  const { data: pub } = db.storage.from("avatars").getPublicUrl(storagePath);
  return {
    storagePath,
    publicUrl: pub.publicUrl,
    previewUrl: pub.publicUrl,
    slotId,
  };
}

export async function generateAvatarsAction(): Promise<OnboardingActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };

  const state = await loadState();
  if (!state.child?.displayName) {
    return { error: "Complete o perfil da criança." };
  }
  if (!state.friend?.displayName) {
    return { error: "Complete o melhor amigo." };
  }
  // Reuse: se já há avatares, não regenera
  if (state.childAvatarUrl && state.friendAvatarUrl) {
    return {
      success: true,
      childAvatarUrl: state.childAvatarUrl,
      friendAvatarUrl: state.friendAvatarUrl,
      engine: "reuse",
    };
  }

  const childMiss = assertCompletePhotos(state.childPhotos, "child");
  if (childMiss && !state.childAvatarUrl) {
    return { error: `Fotos da criança: ${childMiss}` };
  }
  const friendMiss = assertCompletePhotos(state.friendPhotos, "friend");
  if (friendMiss && !state.friendAvatarUrl) {
    return { error: `Fotos do amigo: ${friendMiss}` };
  }

  const childPreview = state.childAvatarUrl
    ? { url: state.childAvatarUrl, engine: "reuse" as const }
    : await generateAvatarPreview({
        subjectName: state.child.displayName,
        kind: "child",
      });
  const friendPreview = state.friendAvatarUrl
    ? { url: state.friendAvatarUrl, engine: "reuse" as const }
    : await generateAvatarPreview({
        subjectName: state.friend.displayName,
        kind: state.friend.kind,
      });

  state.childAvatarUrl = childPreview.url;
  state.friendAvatarUrl = friendPreview.url;
  await writeMockOnboarding(state);

  if (isSupabaseConfigured() && !user.isMock) {
    const db = createAdminClient() ?? (await createClient());
    if (db) {
      const { data: children } = await db
        .from("children")
        .select("id")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      const childId = children?.[0]?.id;
      if (childId) {
        await db
          .from("children")
          .update({
            avatar_url: childPreview.url,
            avatar_model_id: `lora-sim:${user.id}`,
          })
          .eq("id", childId);

        // Personagem principal (criança)
        const { data: existingChars } = await db
          .from("characters")
          .select("id, is_primary")
          .eq("parent_id", user.id);

        const primary = existingChars?.find((c) => c.is_primary);
        if (primary) {
          await db
            .from("characters")
            .update({
              name: state.child.displayName,
              description: "Avatar principal da criança",
              avatar_url: childPreview.url,
              lora_model_id: `lora-sim:${user.id}:child`,
            })
            .eq("id", primary.id);
        } else {
          await db.from("characters").insert({
            parent_id: user.id,
            child_id: childId,
            name: state.child.displayName,
            is_primary: true,
            description: "Avatar principal da criança",
            avatar_url: childPreview.url,
            lora_model_id: `lora-sim:${user.id}:child`,
          });
        }

        // Melhor amigo
        const friendName = state.friend.displayName;
        const friendExisting = existingChars?.find((c) => !c.is_primary);
        if (friendExisting) {
          await db
            .from("characters")
            .update({
              name: friendName,
              description: `Melhor amigo (${state.friend.kind})`,
              avatar_url: friendPreview.url,
              lora_model_id: `lora-sim:${user.id}:friend`,
            })
            .eq("id", friendExisting.id);
        } else {
          await db.from("characters").insert({
            parent_id: user.id,
            child_id: childId,
            name: friendName,
            is_primary: false,
            description: `Melhor amigo (${state.friend.kind})`,
            avatar_url: friendPreview.url,
            lora_model_id: `lora-sim:${user.id}:friend`,
          });
        }
      }
    }
  }

  return {
    success: true,
    childAvatarUrl: childPreview.url,
    friendAvatarUrl: friendPreview.url,
    engine: childPreview.engine,
  };
}

export async function finishAvatarOnboardingAction(): Promise<OnboardingActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };

  const state = await loadState();
  if (!state.securityPin) return { error: "Defina o PIN de segurança." };
  if (!state.child?.displayName) return { error: "Complete o avatar da criança." };
  if (!state.friend?.displayName && !state.friendAvatarUrl) {
    return { error: "Complete o melhor amigo." };
  }
  if (!state.childAvatarUrl || !state.friendAvatarUrl) {
    return { error: "Gere os personagens antes de continuar." };
  }

  state.completed = true;
  await writeMockOnboarding(state);

  if (!isSupabaseConfigured() || user.isMock) {
    const session = await readMockSession();
    if (session) {
      await writeMockSession({ ...session, onboardingCompleted: true });
    }
    revalidatePath("/app/parent");
    redirect("/app/parent");
  }

  const db = createAdminClient() ?? (await createClient());
  if (!db) return { error: "Supabase indisponível." };

  const { error } = await db
    .from("users")
    .update({
      onboarding_completed: true,
      security_pin: state.securityPin,
      onboarding_reset_mode: null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/app/parent");
  redirect("/app/parent");
}
