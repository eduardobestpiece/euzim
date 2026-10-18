import { NextResponse } from "next/server";
import { confirmAvatarSelectionAction } from "@/lib/onboarding/actions";

export async function POST(request: Request) {
  let body: {
    childAvatarUrl?: string;
    friendAvatarUrl?: string;
    childFaceSheetUrl?: string | null;
    childBodySheetUrl?: string | null;
    friendSheetUrl?: string | null;
    engine?: string | null;
    markRedoUsed?: boolean;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.childAvatarUrl || !body.friendAvatarUrl) {
    return NextResponse.json(
      { error: "Avatares da criança e do amigo são obrigatórios." },
      { status: 400 },
    );
  }

  const result = await confirmAvatarSelectionAction({
    childAvatarUrl: body.childAvatarUrl,
    friendAvatarUrl: body.friendAvatarUrl,
    childFaceSheetUrl: body.childFaceSheetUrl,
    childBodySheetUrl: body.childBodySheetUrl,
    friendSheetUrl: body.friendSheetUrl,
    engine: body.engine,
    markRedoUsed: body.markRedoUsed !== false,
  });

  if (result.error) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
