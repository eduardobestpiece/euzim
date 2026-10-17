export type CharacterKind = "child" | "adult" | "pet" | "toy" | "other";

export type CharacterGender =
  | "boy"
  | "girl"
  | "other"
  | "male"
  | "female"
  | null;

export const RELATIONSHIP_OPTIONS = [
  { value: "child", label: "Filho(a)" },
  { value: "father", label: "Pai" },
  { value: "mother", label: "Mãe" },
  { value: "sibling", label: "Irmão/Irmã" },
  { value: "grandparent", label: "Avô/Avó" },
  { value: "uncle_aunt", label: "Tio/Tia" },
  { value: "cousin", label: "Primo(a)" },
  { value: "friend", label: "Amigo(a)" },
  { value: "pet", label: "Pet" },
  { value: "toy", label: "Brinquedo" },
  { value: "other", label: "Outro" },
] as const;

export type RelationshipValue =
  (typeof RELATIONSHIP_OPTIONS)[number]["value"];

export type CharacterManageRow = {
  id: string;
  name: string;
  isPrimary?: boolean;
  avatarUrl?: string | null;
  relationship?: string | null;
  relationshipOther?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  kind?: string | null;
  description?: string | null;
};

export type ChildFamilyMeta = {
  id: string;
  displayName: string;
  birthDate?: string | null;
  gender?: string | null;
  hasFather: boolean;
  fatherName?: string | null;
  fatherBirthDate?: string | null;
  hasMother: boolean;
  motherName?: string | null;
  motherBirthDate?: string | null;
};
