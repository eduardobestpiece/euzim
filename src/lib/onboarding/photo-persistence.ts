import type { OnboardingPhotoDraft } from "@/lib/auth/types";
import { getSupabaseEnv } from "@/lib/supabase/config";
import type { PhotoSubject } from "@/lib/onboarding/photo-slots";

export type StoredPhotoPath = {
  slotId?: string;
  path?: string;
  url?: string;
};

export function publicUrlFromStoragePath(path: string): string | undefined {
  if (!path || path.startsWith("mock/") || path.startsWith("local/") || path.startsWith("pending/")) {
    return undefined;
  }
  const { url } = getSupabaseEnv();
  if (!url) return undefined;
  const clean = path.replace(/^avatars\//, "");
  return `${url}/storage/v1/object/public/avatars/${clean}`;
}

export function draftsFromStoredPaths(
  paths: StoredPhotoPath[] | undefined,
): OnboardingPhotoDraft[] {
  if (!paths?.length) return [];
  return paths
    .filter((p) => p.slotId && (p.path || p.url))
    .map((p) => {
      const storagePath = p.path || "";
      const publicUrl = p.url || publicUrlFromStoragePath(storagePath);
      return {
        id: p.slotId!,
        slotId: p.slotId!,
        name: p.slotId!,
        previewUrl: publicUrl || "",
        storagePath,
        publicUrl,
      };
    });
}

export function storedPathsFromDrafts(
  photos: OnboardingPhotoDraft[],
): StoredPhotoPath[] {
  return photos.map((p) => ({
    slotId: p.slotId,
    path: p.storagePath,
    url: p.publicUrl || publicUrlFromStoragePath(p.storagePath),
  }));
}

export function preferenceKeyForSubject(
  subject: PhotoSubject,
): "photo_paths" | "friend_photo_paths" {
  return subject === "friend" ? "friend_photo_paths" : "photo_paths";
}
