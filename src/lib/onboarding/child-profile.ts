export type ChildGender = "boy" | "girl" | "other";

/** Só Masculino / Feminino na UI do onboard. */
export const GENDER_LABELS: Record<"boy" | "girl", string> = {
  boy: "Masculino",
  girl: "Feminino",
};

/** Cache-bust quando as guias 3D mudam (evita SVG flat antigo no browser). */
export const GUIDE_ASSET_VERSION = "7";

export function guideFolderForGender(
  gender: ChildGender | null | undefined,
): "boy" | "girl" | "neutral" {
  if (gender === "girl") return "girl";
  // boy + other/null → menino 3D (nunca SVG flat)
  if (gender === "boy") return "boy";
  return "neutral";
}

/** Só PNG das folhas Pixar - nunca SVG. */
export function guideSrc(
  gender: ChildGender | null | undefined,
  slotId: string,
): string {
  return `/onboarding/guides/${guideFolderForGender(gender)}/${slotId}.png?v=${GUIDE_ASSET_VERSION}`;
}

/** Guias do amigo: dog/cat/toy Disney-like em public/onboarding/guides/friend. */
export function friendGuideSrc(slotId: string): string {
  return `/onboarding/guides/friend/${slotId}.png?v=${GUIDE_ASSET_VERSION}`;
}

/** Idade em anos completos a partir de YYYY-MM-DD. */
export function ageYearsFromBirthDate(birthDate: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  const birth = new Date(y, m - 1, d);
  if (Number.isNaN(birth.getTime())) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const md = now.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function validateBirthDate(birthDate: string): string | null {
  const age = ageYearsFromBirthDate(birthDate);
  if (age == null) return "Informe uma data de nascimento válida.";
  if (age < 0) return "A data não pode ser no futuro.";
  if (age > 17) return "O Euzim é para crianças até 17 anos.";
  if (age < 1) return "A criança precisa ter pelo menos 1 ano.";
  return null;
}

export function nextAvatarRefreshDue(from = new Date()): Date {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

export function isAvatarRefreshDue(dueAt: string | null | undefined, now = new Date()): boolean {
  if (!dueAt) return false;
  return new Date(dueAt).getTime() <= now.getTime();
}
