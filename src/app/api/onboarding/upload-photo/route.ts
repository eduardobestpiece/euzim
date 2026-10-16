import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler o arquivo (muito grande?)." },
      { status: 413 },
    );
  }

  const slotId = String(form.get("slotId") ?? "");
  const subject = String(form.get("subject") ?? "child");
  const file = form.get("file");
  if (!slotId || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Arquivo ou slot inválido." },
      { status: 400 },
    );
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Envie uma imagem." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "A foto ultrapassa 12 MB. Tire de novo ou escolha outra." },
      { status: 413 },
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext)
    ? ext === "jpeg"
      ? "jpg"
      : ext
    : "jpg";
  const storagePath = `${user.id}/${subject}/${slotId}.${safeExt}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (!isSupabaseConfigured() || user.isMock) {
    return NextResponse.json({
      storagePath: `mock/avatars/${storagePath}`,
      slotId,
    });
  }

  const db = createAdminClient() ?? (await createClient());
  if (!db) {
    return NextResponse.json(
      { error: "Supabase indisponível." },
      { status: 503 },
    );
  }

  const contentType = file.type.startsWith("image/") ? file.type : "image/jpeg";
  const { error: upErr } = await db.storage
    .from("avatars")
    .upload(storagePath, bytes, { contentType, upsert: true });

  if (upErr) {
    return NextResponse.json({
      storagePath: `local/${storagePath}`,
      slotId,
    });
  }

  const { data: pub } = db.storage.from("avatars").getPublicUrl(storagePath);
  return NextResponse.json({
    storagePath,
    publicUrl: pub.publicUrl,
    previewUrl: pub.publicUrl,
    slotId,
  });
}
