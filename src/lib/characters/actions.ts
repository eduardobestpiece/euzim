"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CharacterUpdateInput = {
  id: string;
  name: string;
  relationship?: string | null;
  relationshipOther?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  kind?: string | null;
  description?: string | null;
};

export type ChildFamilyUpdateInput = {
  childId: string;
  hasFather: boolean;
  fatherName?: string | null;
  fatherBirthDate?: string | null;
  hasMother: boolean;
  motherName?: string | null;
  motherBirthDate?: string | null;
};

async function db() {
  return createAdminClient() ?? (await createClient());
}

export async function updateCharacterAction(
  input: CharacterUpdateInput,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };
  const name = input.name.trim();
  if (!name) return { error: "Informe o nome." };

  const client = await db();
  if (!client) return { error: "Banco indisponível." };

  const { error } = await client
    .from("characters")
    .update({
      name,
      relationship: input.relationship || null,
      relationship_other: input.relationshipOther || null,
      gender: input.gender || null,
      birth_date: input.birthDate || null,
      kind: input.kind || null,
      description: input.description || null,
    })
    .eq("id", input.id)
    .eq("parent_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/app/parent");
  return {};
}

export async function updateChildFamilyAction(
  input: ChildFamilyUpdateInput,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login." };
  const client = await db();
  if (!client) return { error: "Banco indisponível." };

  const { error } = await client
    .from("children")
    .update({
      has_father: input.hasFather,
      father_name: input.hasFather ? input.fatherName || null : null,
      father_birth_date: input.hasFather
        ? input.fatherBirthDate || null
        : null,
      has_mother: input.hasMother,
      mother_name: input.hasMother ? input.motherName || null : null,
      mother_birth_date: input.hasMother
        ? input.motherBirthDate || null
        : null,
    })
    .eq("id", input.childId)
    .eq("parent_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/app/parent");
  return {};
}
