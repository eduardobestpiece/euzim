import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { convertUploadToJpeg } from "@/lib/onboarding/convert-upload-image";
import {
  preferenceKeyForSubject,
  type StoredPhotoPath,
} from "@/lib/onboarding/photo-persistence";
import type { PhotoSubject } from "@/lib/onboarding/photo-slots";

const MAX_BYTES = 12 * 1024 * 1024;

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i;

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT.test(file.name) || file.type === "";
}

async function registerPhotoInDb(input: {
  userId: string;
  subject: PhotoSubject;
  slotId: string;
  storagePath: string;
  publicUrl: string;
}) {
  const db = createAdminClient() ?? (await createClient());
  if (!db) return;

  const { data: children } = await db
    .from("children")
    .select("id, preferences")
    .eq("parent_id", input.userId)
    .order("created_at", { ascending: true })
    .limit(1);
  const child = children?.[0];
  if (!child?.id) return;

  const prefs =
    child.preferences && typeof child.preferences === "object"
      ? ({ ...(child.preferences as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {};
  const key = preferenceKeyForSubject(input.subject);
  const existing = Array.isArray(prefs[key])
    ? ([...(prefs[key] as StoredPhotoPath[])] as StoredPhotoPath[])
    : [];
  const nextEntry: StoredPhotoPath = {
    slotId: input.slotId,
    path: input.storagePath,
    url: input.publicUrl,
  };
  const idx = existing.findIndex((p) => p.slotId === input.slotId);
  if (idx >= 0) existing[idx] = nextEntry;
  else existing.push(nextEntry);
  prefs[key] = existing;

  await db.from("children").update({ preferences: prefs }).eq("id", child.id);
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
  const subjectRaw = String(form.get("subject") ?? "child");
  const subject: PhotoSubject =
    subjectRaw === "friend" ? "friend" : "child";
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

  const previewPayload = converted.previewDataUrl
    ? {
        previewDataUrl: converted.previewDataUrl,
        previewUrl: converted.previewDataUrl,
      }
    : {};

  if (!isSupabaseConfigured() || user.isMock) {
    return NextResponse.json({
      storagePath: `mock/avatars/${storagePath}`,
      slotId,
      converted: converted.converted,
      bytes: converted.buffer.length,
      ...previewPayload,
    });
  }

  const db = createAdminClient() ?? (await createClient());
  if (!db) {
    return NextResponse.json({
      storagePath: `local/${storagePath}`,
      slotId,
      warning: "Supabase indisponível; foto ficou só no aparelho.",
      converted: converted.converted,
      bytes: converted.buffer.length,
      ...previewPayload,
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
      ...previewPayload,
    });
  }

  const { data: pub } = db.storage.from("avatars").getPublicUrl(storagePath);

  // Grava path no banco a cada upload — não depende do cookie
  try {
    await registerPhotoInDb({
      userId: user.id,
      subject,
      slotId,
      storagePath,
      publicUrl: pub.publicUrl,
    });
  } catch {
    // upload ok; persistência em lote no "Continuar" ainda cobre
  }

  return NextResponse.json({
    storagePath,
    publicUrl: pub.publicUrl,
    previewUrl: converted.previewDataUrl || pub.publicUrl,
    slotId,
    converted: converted.converted,
    bytes: converted.buffer.length,
    savedToDb: true,
    ...previewPayload,
  });
}
