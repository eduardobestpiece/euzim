import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { convertUploadToJpeg } from "@/lib/onboarding/convert-upload-image";

const MAX_BYTES = 12 * 1024 * 1024;

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i;

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT.test(file.name) || file.type === "";
}

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
  if (!isImageFile(file)) {
    return NextResponse.json({ error: "Envie uma imagem." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "A foto ultrapassa 12 MB. Tire de novo ou escolha outra." },
      { status: 413 },
    );
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const converted = await convertUploadToJpeg(raw);
  const storagePath = `${user.id}/${subject}/${slotId}.${converted.ext}`;

  if (!isSupabaseConfigured() || user.isMock) {
    return NextResponse.json({
      storagePath: `mock/avatars/${storagePath}`,
      slotId,
      converted: converted.converted,
      bytes: converted.buffer.length,
    });
  }

  const db = createAdminClient() ?? (await createClient());
  if (!db) {
    // Ainda devolve path local — o cliente já mostrou o preview
    return NextResponse.json({
      storagePath: `local/${storagePath}`,
      slotId,
      warning: "Supabase indisponível; foto ficou só no aparelho.",
      converted: converted.converted,
      bytes: converted.buffer.length,
    });
  }

  const { error: upErr } = await db.storage
    .from("avatars")
    .upload(storagePath, converted.buffer, {
      contentType: converted.contentType,
      upsert: true,
    });

  if (upErr) {
    return NextResponse.json({
      storagePath: `local/${storagePath}`,
      slotId,
      warning: upErr.message || "Storage falhou; preview local mantido.",
      converted: converted.converted,
      bytes: converted.buffer.length,
    });
  }

  const { data: pub } = db.storage.from("avatars").getPublicUrl(storagePath);
  return NextResponse.json({
    storagePath,
    publicUrl: pub.publicUrl,
    previewUrl: pub.publicUrl,
    slotId,
    converted: converted.converted,
    bytes: converted.buffer.length,
  });
}
