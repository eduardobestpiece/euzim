import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  listAcceptedFriendsWithCharacters,
  loadCombinedCastCharacters,
} from "@/lib/social/friend-cast";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }

  const url = new URL(request.url);
  const friendParentId = url.searchParams.get("friendParentId");

  if (friendParentId) {
    const loaded = await loadCombinedCastCharacters({
      userId: user.id,
      friendParentId,
    });
    if (loaded.error) {
      return NextResponse.json({ error: loaded.error }, { status: 400 });
    }
    return NextResponse.json({
      friendParentId,
      characters: loaded.characters ?? [],
    });
  }

  const friends = await listAcceptedFriendsWithCharacters(user.id);
  return NextResponse.json({ friends });
}
