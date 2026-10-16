export type ChildGender = "boy" | "girl" | "other";

export const GENDER_LABELS: Record<ChildGender, string> = {
  boy: "Menino",
  girl: "Menina",
  other: "Prefiro não dizer",
};

export function guideFolderForGender(
  gender: ChildGender | null | undefined,
): "boy" | "girl" | "neutral" {
  if (gender === "boy") return "boy";
  if (gender === "girl") return "girl";
  return "neutral";
}

export function guideSrc(
  gender: ChildGender | null | undefined,
  slotId: string,
): string {
  return `/onboarding/guides/${guideFolderForGender(gender)}/${slotId}.png`;
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
  if (age > 17) return "O Estúdio Mágico é para crianças até 17 anos.";
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
