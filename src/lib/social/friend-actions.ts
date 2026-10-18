"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadPrimaryAuthors } from "@/lib/social/primary-author";
import { ensureReferralCode } from "@/lib/referral/codes";
import type {
  FriendProfile,
  FriendshipStatus,
  PendingFriendship,
} from "@/lib/social/types";

async function dbClient() {
  return createAdminClient() ?? (await createClient());
}

async function existingFriendship(
  db: NonNullable<Awaited<ReturnType<typeof dbClient>>>,
  a: string,
  b: string,
) {
  const { data } = await db
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`,
    )
    .maybeSingle();
  return data;
}

export async function requestFriendshipAction(
  addresseeId: string,
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Não autenticado." };
  if (addresseeId === user.id) return { error: "Não é possível adicionar a si mesmo." };

  const db = await dbClient();
  if (!db) return { error: "Banco indisponível." };

  const existing = await existingFriendship(db, user.id, addresseeId);
  if (existing?.status === "accepted") {
    return { error: "Vocês já são amigos." };
  }
  if (existing?.status === "pending") {
    return { error: "Pedido já enviado." };
  }

  if (existing?.status === "rejected") {
    const { error } = await db
      .from("friendships")
      .update({
        status: "pending",
        requester_id: user.id,
        addressee_id: addresseeId,
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from("friendships").insert({
      requester_id: user.id,
      addressee_id: addresseeId,
      status: "pending",
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/app/social");
  return { success: true };
}

export async function respondFriendshipAction(
  friendshipId: string,
  decision: "accepted" | "rejected",
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Não autenticado." };

  const db = await dbClient();
  if (!db) return { error: "Banco indisponível." };

  const { data: row, error: loadError } = await db
    .from("friendships")
    .select("id, addressee_id, status")
    .eq("id", friendshipId)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!row) return { error: "Pedido não encontrado." };
  if (row.addressee_id !== user.id) {
    return { error: "Só o destinatário pode responder." };
  }
  if (row.status !== "pending") {
    return { error: "Este pedido já foi respondido." };
  }

  const { error } = await db
    .from("friendships")
    .update({ status: decision })
    .eq("id", friendshipId);

  if (error) return { error: error.message };
  revalidatePath("/app/social");
  revalidatePath("/invite");
  return { success: true };
}

async function profileFromUserRow(
  db: NonNullable<Awaited<ReturnType<typeof dbClient>>>,
  viewerId: string,
  found: { id: string; email: string | null },
): Promise<FriendProfile> {
  if (found.id === viewerId) {
    return {
      userId: found.id,
      email: found.email ?? "",
      authorName: "Você",
      authorAvatarUrl: null,
      friendshipStatus: "self",
    };
  }
  const authors = await loadPrimaryAuthors(db, [found.id]);
  const author = authors.get(found.id) ?? { name: "Amigo", avatarUrl: null };
  const friendship = await existingFriendship(db, viewerId, found.id);
  return {
    userId: found.id,
    email: found.email ?? "",
    authorName: author.name,
    authorAvatarUrl: author.avatarUrl,
    friendshipStatus: (friendship?.status as FriendshipStatus) ?? "none",
  };
}

export async function searchParentByEmailAction(
  email: string,
): Promise<{ error?: string; profile?: FriendProfile }> {
  return searchParentByQueryAction(email);
}

/** Busca amigo por e-mail ou nome (full_name / display_name). */
export async function searchParentByQueryAction(
  query: string,
): Promise<{ error?: string; profile?: FriendProfile; profiles?: FriendProfile[] }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Não autenticado." };

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { error: "Digite pelo menos 2 caracteres." };
  }

  const db = await dbClient();
  if (!db) return { error: "Banco indisponível." };

  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    const { data: found, error } = await db
      .from("users")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!found) return { error: "Nenhuma conta encontrada com este e-mail." };
    const profile = await profileFromUserRow(db, user.id, found);
    return { profile, profiles: [profile] };
  }

  const pattern = `%${trimmed}%`;
  const [{ data: byFull }, { data: byDisplay }, { data: byEmail }] =
    await Promise.all([
      db
        .from("users")
        .select("id, email")
        .ilike("full_name", pattern)
        .limit(8),
      db
        .from("users")
        .select("id, email")
        .ilike("display_name", pattern)
        .limit(8),
      db.from("users").select("id, email").ilike("email", pattern).limit(8),
    ]);

  const merged = new Map<string, { id: string; email: string | null }>();
  for (const row of [...(byFull ?? []), ...(byDisplay ?? []), ...(byEmail ?? [])]) {
    if (row?.id) merged.set(row.id, row);
  }
  if (merged.size === 0) {
    return { error: "Nenhuma conta encontrada com este nome ou e-mail." };
  }

  const profiles = await Promise.all(
    [...merged.values()]
      .slice(0, 8)
      .map((row) => profileFromUserRow(db, user.id, row)),
  );
  return { profile: profiles[0], profiles };
}

export async function countAcceptedFriends(userId: string): Promise<number> {
  const db = await dbClient();
  if (!db) return 0;
  const { data, error } = await db
    .from("friendships")
    .select("id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) return 0;
  return data?.length ?? 0;
}

export async function listPendingFriendRequests(
  userId: string,
): Promise<PendingFriendship[]> {
  const db = await dbClient();
  if (!db) return [];

  const { data } = await db
    .from("friendships")
    .select("id, requester_id, created_at")
    .eq("addressee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const authors = await loadPrimaryAuthors(
    db,
    rows.map((r) => r.requester_id),
  );

  return rows.map((r) => {
    const author = authors.get(r.requester_id) ?? {
      name: "Amigo",
      avatarUrl: null,
    };
    return {
      id: r.id,
      requesterId: r.requester_id,
      authorName: author.name,
      authorAvatarUrl: author.avatarUrl,
      createdAt: r.created_at,
    };
  });
}

export async function createFriendInviteAction(): Promise<{
  error?: string;
  token?: string;
  url?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { error: "Não autenticado." };

  const db = await dbClient();
  if (!db) return { error: "Banco indisponível." };

  const { data, error } = await db
    .from("friend_invites")
    .insert({ inviter_id: user.id, status: "pending" })
    .select("token")
    .single();

  if (error || !data?.token) {
    return { error: error?.message ?? "Falha ao criar convite." };
  }

  // Anexa ref do convidante (último clique no destino)
  const code = await ensureReferralCode(user.id);
  const qs = code ? `?ref=${encodeURIComponent(code)}` : "";

  return {
    token: data.token,
    url: `/invite/${data.token}${qs}`,
  };
}

export async function loadFriendInvite(token: string): Promise<{
  error?: string;
  invite?: {
    token: string;
    inviterId: string;
    authorName: string;
    authorAvatarUrl: string | null;
    status: string;
    expired: boolean;
  };
}> {
  const db = await dbClient();
  if (!db) return { error: "Banco indisponível." };

  const { data, error } = await db
    .from("friend_invites")
    .select("token, inviter_id, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Convite não encontrado." };

  const expired =
    data.status !== "pending" ||
    (data.expires_at ? new Date(data.expires_at).getTime() < Date.now() : false);

  const authors = await loadPrimaryAuthors(db, [data.inviter_id]);
  const author = authors.get(data.inviter_id) ?? {
    name: "Amigo",
    avatarUrl: null,
  };

  return {
    invite: {
      token: data.token,
      inviterId: data.inviter_id,
      authorName: author.name,
      authorAvatarUrl: author.avatarUrl,
      status: data.status,
      expired,
    },
  };
}

export async function respondFriendInviteAction(
  token: string,
  decision: "accepted" | "rejected",
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Não autenticado." };

  const db = await dbClient();
  if (!db) return { error: "Banco indisponível." };

  const { data: invite, error: loadError } = await db
    .from("friend_invites")
    .select("id, inviter_id, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!invite) return { error: "Convite não encontrado." };
  if (invite.status !== "pending") {
    return { error: "Este convite já foi usado." };
  }
  if (
    invite.expires_at &&
    new Date(invite.expires_at).getTime() < Date.now()
  ) {
    await db
      .from("friend_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);
    return { error: "Convite expirado." };
  }
  if (invite.inviter_id === user.id) {
    return { error: "Você não pode aceitar o próprio convite." };
  }

  if (decision === "rejected") {
    const { error } = await db
      .from("friend_invites")
      .update({ status: "rejected", accepted_by: user.id })
      .eq("id", invite.id);
    if (error) return { error: error.message };
    return { success: true };
  }

  const existing = await existingFriendship(db, user.id, invite.inviter_id);
  if (!existing) {
    const { error: friendError } = await db.from("friendships").insert({
      requester_id: invite.inviter_id,
      addressee_id: user.id,
      status: "accepted",
    });
    if (friendError) return { error: friendError.message };
  } else if (existing.status !== "accepted") {
    const { error: friendError } = await db
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", existing.id);
    if (friendError) return { error: friendError.message };
  }

  const { error } = await db
    .from("friend_invites")
    .update({ status: "accepted", accepted_by: user.id })
    .eq("id", invite.id);

  if (error) return { error: error.message };
  revalidatePath("/app/social");
  return { success: true };
}
