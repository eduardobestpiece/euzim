import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPixarGeneratedUrl } from "@/lib/onboarding/pixar-url";
import { readMockOnboarding } from "@/lib/auth/mock-session";

export type FriendGender = "male" | "female" | "unknown";

/** Personagem convidado (conta amiga) ou extra selecionado no wizard. */
export type CoPlayMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  parentId: string;
  source: "own" | "friend";
  traitsSummary?: string;
  kind?: string | null;
  isPrimary?: boolean;
};

export type StoryCast = {
  childId: string;
  childName: string;
  childAgeYears: number | null;
  childGender: "boy" | "girl" | "other" | null;
  friendName: string;
  friendKind: "pet" | "toy";
  /** Gênero gramatical do amigo (characters.gender / onboarding). */
  friendGender: FriendGender;
  childHeroUrl: string | null;
  friendHeroUrl: string | null;
  childFaceSheetUrl: string | null;
  childBodySheetUrl: string | null;
  friendSheetUrl: string | null;
  characterId: string | null;
  /**
   * True só quando existem avatares Pixar de pais/irmãos na plataforma.
   * Sem isso, ilustrações devem esconder rostos de família.
   */
  hasFamilyMemberAvatars: boolean;
  /** Elenco expandido (próprios + amigos) para história com amigos. */
  coPlayMembers?: CoPlayMember[];
  /** Conta amiga cujo elenco entrou na história (se houver). */
  friendParentId?: string | null;
};

/** Normaliza gender da tabela characters / onboarding para PT. */
export function normalizeFriendGender(
  raw: string | null | undefined,
): FriendGender {
  const g = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (
    g === "female" ||
    g === "girl" ||
    g === "f" ||
    g === "feminino" ||
    g === "feminina"
  ) {
    return "female";
  }
  if (
    g === "male" ||
    g === "boy" ||
    g === "m" ||
    g === "masculino" ||
    g === "masculina"
  ) {
    return "male";
  }
  return "unknown";
}

function ageFromBirth(birth: string | null | undefined): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 18 ? age : null;
}

/** Carrega elenco + folhas Pixar do filho principal. */
export async function loadStoryCast(parentId: string): Promise<StoryCast | null> {
  const db = createAdminClient() ?? (await createClient());
  if (!db) {
    const onboarding = await readMockOnboarding();
    if (!onboarding?.child?.displayName) return null;
    return {
      childId: "mock-child",
      childName: onboarding.child.displayName,
      childAgeYears: onboarding.child.ageYears ?? null,
      childGender: onboarding.child.gender ?? null,
      friendName: onboarding.friend?.displayName || "Amigo",
      friendKind: onboarding.friend?.kind === "toy" ? "toy" : "pet",
      friendGender: normalizeFriendGender(
        (onboarding.friend as { gender?: string } | undefined)?.gender,
      ),
      childHeroUrl: isPixarGeneratedUrl(onboarding.childAvatarUrl)
        ? onboarding.childAvatarUrl!
        : null,
      friendHeroUrl: isPixarGeneratedUrl(onboarding.friendAvatarUrl)
        ? onboarding.friendAvatarUrl!
        : null,
      childFaceSheetUrl: isPixarGeneratedUrl(onboarding.childFaceSheetUrl)
        ? onboarding.childFaceSheetUrl!
        : null,
      childBodySheetUrl: isPixarGeneratedUrl(onboarding.childBodySheetUrl)
        ? onboarding.childBodySheetUrl!
        : null,
      friendSheetUrl: isPixarGeneratedUrl(onboarding.friendSheetUrl)
        ? onboarding.friendSheetUrl!
        : null,
      characterId: null,
      hasFamilyMemberAvatars: false,
    };
  }

  const { data: children } = await db
    .from("children")
    .select("id, display_name, birth_date, gender, avatar_url, preferences")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true })
    .limit(1);

  const child = children?.[0];
  if (!child) return null;

  const prefs = (child.preferences ?? {}) as {
    friend?: { kind?: string; displayName?: string };
    age_years?: number;
    pixar?: {
      child_hero?: string;
      friend_hero?: string;
      child_face_sheet?: string;
      child_body_sheet?: string;
      friend_sheet?: string;
    };
  };

  const { data: chars } = await db
    .from("characters")
    .select(
      "id, name, avatar_url, is_primary, traits, description, relationship, kind, gender",
    )
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true });

  const primary = chars?.find((c) => c.is_primary) ?? chars?.[0];
  const friendChar =
    chars?.find(
      (c) =>
        !c.is_primary &&
        (c.kind === "pet" ||
          c.kind === "toy" ||
          c.relationship === "pet" ||
          c.relationship === "toy"),
    ) ?? chars?.find((c) => !c.is_primary);

  const friendName =
    prefs.friend?.displayName || friendChar?.name || "Amigo";
  const friendKind: "pet" | "toy" =
    prefs.friend?.kind === "toy" ||
    friendChar?.kind === "toy" ||
    friendChar?.relationship === "toy"
      ? "toy"
      : "pet";
  const friendGender = normalizeFriendGender(
    (friendChar as { gender?: string } | undefined)?.gender ??
      (prefs.friend as { gender?: string } | undefined)?.gender,
  );

  // Avatares de família (pais/irmãos): relationship/kind + traits + Pixar.
  const familyHints =
    /\b(pai|mãe|mae|parent|father|mother|irmão|irmao|irmã|irma|sibling|brother|sister|cuidador)\b/i;
  const familyRels = new Set([
    "father",
    "mother",
    "sibling",
    "grandparent",
    "uncle_aunt",
  ]);
  const hasFamilyMemberAvatars = (chars ?? []).some((c) => {
    if (!isPixarGeneratedUrl(c.avatar_url)) return false;
    if (c.is_primary) return false;
    if (c.id === friendChar?.id) return false;
    if (c.relationship && familyRels.has(String(c.relationship))) return true;
    if (c.kind === "adult") return true;
    const traits = Array.isArray(c.traits)
      ? c.traits.map(String).join(" ")
      : JSON.stringify(c.traits ?? "");
    return familyHints.test(
      `${c.name} ${c.description ?? ""} ${c.relationship ?? ""} ${traits}`,
    );
  });

  return {
    childId: child.id,
    childName: child.display_name,
    childAgeYears: prefs.age_years ?? ageFromBirth(child.birth_date),
    childGender:
      child.gender === "boy" || child.gender === "girl" || child.gender === "other"
        ? child.gender
        : null,
    friendName,
    friendKind,
    friendGender,
    childHeroUrl: isPixarGeneratedUrl(prefs.pixar?.child_hero)
      ? prefs.pixar!.child_hero!
      : isPixarGeneratedUrl(child.avatar_url)
        ? child.avatar_url!
        : isPixarGeneratedUrl(primary?.avatar_url)
          ? primary!.avatar_url!
          : null,
    friendHeroUrl: isPixarGeneratedUrl(prefs.pixar?.friend_hero)
      ? prefs.pixar!.friend_hero!
      : isPixarGeneratedUrl(friendChar?.avatar_url)
        ? friendChar!.avatar_url!
        : null,
    childFaceSheetUrl: isPixarGeneratedUrl(prefs.pixar?.child_face_sheet)
      ? prefs.pixar!.child_face_sheet!
      : null,
    childBodySheetUrl: isPixarGeneratedUrl(prefs.pixar?.child_body_sheet)
      ? prefs.pixar!.child_body_sheet!
      : null,
    friendSheetUrl: isPixarGeneratedUrl(prefs.pixar?.friend_sheet)
      ? prefs.pixar!.friend_sheet!
      : null,
    characterId: primary?.id ?? null,
    hasFamilyMemberAvatars,
  };
}
