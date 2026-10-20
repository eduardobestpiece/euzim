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
  /**
   * Travamento visual do companheiro (espécie/cores/forma do avatar).
   * Impede a IA de inventar outro bicho (ex.: coelho genérico no lugar da Bingo).
   */
  companionVisualLock: string;
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

function summarizeTraits(traits: unknown, description?: string | null): string {
  const parts: string[] = [];
  if (description?.trim()) parts.push(description.trim());
  if (Array.isArray(traits)) {
    parts.push(traits.map(String).filter(Boolean).join(", "));
  } else if (traits && typeof traits === "object") {
    parts.push(JSON.stringify(traits).slice(0, 160));
  }
  return parts.filter(Boolean).join(" — ").slice(0, 240);
}

/** Extrai espécie canônica dos traits/description (ex.: species:dog → dog). */
export function extractCompanionSpecies(
  traitsOrSummary?: unknown,
  description?: string | null,
): string | null {
  const blob = [
    typeof traitsOrSummary === "string"
      ? traitsOrSummary
      : Array.isArray(traitsOrSummary)
        ? traitsOrSummary.map(String).join(" ")
        : traitsOrSummary && typeof traitsOrSummary === "object"
          ? JSON.stringify(traitsOrSummary)
          : "",
    description ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const tagged = blob.match(/species[_:\s-]*([a-záéíóúãõâêôç\s-]{2,40})/i);
  if (tagged?.[1]) {
    const s = tagged[1].replace(/[,;|].*$/, "").trim();
    if (s.length >= 2) return s.slice(0, 40);
  }

  const map: Array<[RegExp, string]> = [
    [/\b(dog|cão|cao|cachorr[oa]|puppy|heeler)\b/, "dog"],
    [/\b(cat|gat[oa]|kitten)\b/, "cat"],
    [/\b(rabbit|coelh[oa]|bunny)\b/, "rabbit"],
    [/\b(bear|urs[oa])\b/, "bear"],
    [/\b(monkey|macaco|macaca)\b/, "monkey"],
    [/\b(bird|pássaro|passaro)\b/, "bird"],
    [/\b(dinosaur|dinossauro)\b/, "dinosaur"],
  ];
  for (const [re, label] of map) {
    if (re.test(blob)) return label;
  }
  return null;
}

export function companionSpeciesLabel(cast: StoryCast): string | null {
  const fromLock = extractCompanionSpecies(cast.companionVisualLock);
  if (fromLock) return fromLock;
  return null;
}

/** Linha curta para prompts: SPECIES LOCK vence prosa. */
export function speciesLockPromptLine(cast: StoryCast): string {
  const species = companionSpeciesLabel(cast);
  if (!species) {
    return `SPECIES LOCK: "${cast.friendName}" appearance follows avatar traits/refs ONLY — never invent a different animal species in text or image.`;
  }
  return `SPECIES LOCK (AUTHORITATIVE): "${cast.friendName}" IS a ${species} (from avatar traits). PROHIBITED: calling or drawing them as rabbit/monkey/bear/other species. Traits beat prose.`;
}

/**
 * Se o texto inventou espécie errada (coelho/macaco…), normaliza menções
 * para o nome + espécie dos traits.
 */
export function enforceCompanionSpeciesInText(
  text: string,
  cast: StoryCast,
): string {
  const species = companionSpeciesLabel(cast);
  if (!species || !text.trim()) return text;
  const name = cast.friendName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wrongAlt =
    "coelhinho|coelhinha|coelho|coelha|bunny|rabbit|ursinho|ursinha|macaco|macaca|monkey";
  const speciesPt =
    species === "dog"
      ? cast.friendGender === "female"
        ? "cachorrinha"
        : "cachorrinho"
      : species;

  let out = text;
  // "coelhinho de pelúcia Bingo" → "Bingo"
  out = out.replace(
    new RegExp(`\\b(?:${wrongAlt})(?:\\s+de\\s+pel[uú]cia)?\\s+${name}\\b`, "gi"),
    cast.friendName,
  );
  // "Bingo, o coelhinho" → "Bingo"
  out = out.replace(
    new RegExp(
      `\\b${name}\\s*,?\\s*(?:o|a|seu|sua)?\\s*(?:${wrongAlt})\\b`,
      "gi",
    ),
    cast.friendName,
  );

  // Em frases que citam o companion, troca espécie inventada pela dos traits
  const sentences = out.split(/(?<=[.!?…])\s+/);
  out = sentences
    .map((s) => {
      if (!new RegExp(name, "i").test(s)) return s;
      if (!new RegExp(`\\b(?:${wrongAlt})\\b`, "i").test(s)) return s;
      return s
        .replace(new RegExp(`\\b(?:${wrongAlt})\\b`, "gi"), speciesPt)
        .replace(
          new RegExp(`${speciesPt}\\s+de\\s+pel[uú]cia\\s+${name}`, "gi"),
          cast.friendName,
        );
    })
    .join(" ");

  return out;
}

/** Texto de trava para prompts: avatar > espécie inventada. */
export function buildCompanionVisualLock(input: {
  friendName: string;
  friendKind: "pet" | "toy";
  friendGender: FriendGender;
  traitsSummary?: string;
  hasAvatar: boolean;
}): string {
  const genderPt =
    input.friendGender === "female"
      ? "feminino (ela/a)"
      : input.friendGender === "male"
        ? "masculino (ele/o)"
        : "gênero conforme o nome";
  const species = extractCompanionSpecies(input.traitsSummary);
  return [
    `COMPANION LOCK OBRIGATÓRIO: "${input.friendName}" é o avatar cadastrado na plataforma`,
    `(tipo ${input.friendKind}, ${genderPt}).`,
    species
      ? `SPECIES LOCK: "${input.friendName}" = ${species} (traits vencem qualquer prosa que diga outro animal).`
      : "",
    input.hasAvatar
      ? "Há referência visual Pixar — a aparência (espécie, cores, formato, rosto) DEVE seguir ESSA referência."
      : "Sem sheet: ainda assim NÃO invente outra espécie.",
    input.traitsSummary
      ? `Traços cadastrados: ${input.traitsSummary}.`
      : "",
    `PROIBIDO substituir "${input.friendName}" por coelho/urso/macaco/pelúcia genérica ou outro animal que não seja o avatar.`,
    `Se o avatar lembra um personagem conhecido, AINDA ASSIM use o avatar do usuário (é a referência oficial desta história) — não troque por um bicho inventado "para evitar IP".`,
  ]
    .filter(Boolean)
    .join(" ");
}

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
    const mockFriendName = onboarding.friend?.displayName || "Amigo";
    const mockFriendKind =
      onboarding.friend?.kind === "toy" ? "toy" : "pet";
    const mockFriendGender = normalizeFriendGender(
      (onboarding.friend as { gender?: string } | undefined)?.gender,
    );
    return {
      childId: "mock-child",
      childName: onboarding.child.displayName,
      childAgeYears: onboarding.child.ageYears ?? null,
      childGender: onboarding.child.gender ?? null,
      friendName: mockFriendName,
      friendKind: mockFriendKind,
      friendGender: mockFriendGender,
      companionVisualLock: buildCompanionVisualLock({
        friendName: mockFriendName,
        friendKind: mockFriendKind,
        friendGender: mockFriendGender,
        hasAvatar: Boolean(
          isPixarGeneratedUrl(onboarding.friendAvatarUrl) ||
            isPixarGeneratedUrl(onboarding.friendSheetUrl),
        ),
      }),
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
  const friendTraitsSummary = summarizeTraits(
    friendChar?.traits,
    friendChar?.description,
  );
  const friendHasAvatar = Boolean(
    isPixarGeneratedUrl(prefs.pixar?.friend_hero) ||
      isPixarGeneratedUrl(prefs.pixar?.friend_sheet) ||
      isPixarGeneratedUrl(friendChar?.avatar_url),
  );
  const companionVisualLock = buildCompanionVisualLock({
    friendName,
    friendKind,
    friendGender,
    traitsSummary: friendTraitsSummary,
    hasAvatar: friendHasAvatar,
  });

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
    companionVisualLock,
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
