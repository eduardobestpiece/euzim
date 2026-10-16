"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PHOTO_SLOTS,
  REQUIRED_PHOTO_COUNT,
  slotLabel,
  slotTip,
  type PhotoSubject,
  type PhotoSlotDef,
} from "@/lib/onboarding/photo-slots";
import type { OnboardingPhotoDraft } from "@/lib/auth/types";
import { uploadAvatarPhotoAction } from "@/lib/onboarding/actions";

export type SlotPhotos = Record<string, OnboardingPhotoDraft>;

function Silhouette({ kind }: { kind: PhotoSlotDef["silhouette"] }) {
  const transform =
    kind === "angle-r"
      ? "rotate(18deg)"
      : kind === "side-r"
        ? "rotate(35deg)"
        : kind === "angle-l"
          ? "rotate(-18deg)"
          : kind === "side-l"
            ? "rotate(-35deg)"
            : kind === "back"
              ? "scaleX(-1)"
              : undefined;

  return (
    <div
      className="flex h-full w-full items-center justify-center bg-gradient-to-b from-amber-50 to-sky-50"
      aria-hidden
    >
      <div
        className="relative opacity-40"
        style={transform ? { transform } : undefined}
      >
        <div className="mx-auto size-7 rounded-full bg-amber-800/30" />
        <div className="mx-auto mt-1 h-10 w-8 rounded-t-2xl bg-amber-800/25" />
      </div>
    </div>
  );
}

export function PhotoSlotGrid({
  subject,
  value,
  onChange,
}: {
  subject: PhotoSubject;
  value: SlotPhotos;
  onChange: (next: SlotPhotos) => void;
}) {
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<string | null>(
    PHOTO_SLOTS[0]?.id ?? null,
  );
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const filled = Object.keys(value).length;
  const missing = REQUIRED_PHOTO_COUNT - filled;

  async function applyFile(slotId: string, file: File) {
    setBusySlot(slotId);
    setError(null);
    const fd = new FormData();
    fd.set("slotId", slotId);
    fd.set("subject", subject);
    fd.set("file", file);
    const result = await uploadAvatarPhotoAction(fd);
    setBusySlot(null);
    if (result.error && !result.previewUrl) {
      setError(result.error);
      return;
    }
    const localPreview = await readAsDataUrl(file);
    const draft: OnboardingPhotoDraft = {
      id: crypto.randomUUID(),
      slotId,
      name: file.name,
      previewUrl: result.previewUrl || localPreview,
      storagePath: result.storagePath || `local/${slotId}`,
      publicUrl: result.publicUrl,
    };
    onChange({ ...value, [slotId]: draft });
  }

  function openCamera(slotId: string) {
    setActiveSlot(slotId);
    cameraRef.current?.click();
  }

  function openUpload(slotId: string) {
    setActiveSlot(slotId);
    uploadRef.current?.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          {filled}/{REQUIRED_PHOTO_COUNT} fotos
        </p>
        {missing > 0 ? (
          <p className="font-medium text-amber-800">
            Faltam {missing} ângulo{missing > 1 ? "s" : ""}
          </p>
        ) : (
          <p className="flex items-center gap-1 font-medium text-emerald-700">
            <Check className="size-3.5" /> Completo
          </p>
        )}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && activeSlot) void applyFile(activeSlot, file);
        }}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && activeSlot) void applyFile(activeSlot, file);
        }}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PHOTO_SLOTS.map((slot) => {
          const photo = value[slot.id];
          const label = slotLabel(slot, subject);
          const tip = slotTip(slot, subject);
          const busy = busySlot === slot.id;
          return (
            <div
              key={slot.id}
              className={`overflow-hidden rounded-xl border ${
                photo ? "border-emerald-600/40" : "border-border/70"
              }`}
            >
              <div className="relative aspect-[3/4] bg-muted">
                {photo?.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.previewUrl}
                    alt={label}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Silhouette kind={slot.silhouette} />
                )}
                {busy ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
                    Enviando…
                  </div>
                ) : null}
              </div>
              <div className="space-y-2 p-2.5">
                <div>
                  <p className="text-xs font-semibold leading-tight">{label}</p>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {tip}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1 px-1.5 text-[11px]"
                    disabled={busy}
                    onClick={() => openCamera(slot.id)}
                  >
                    <Camera className="size-3" />
                    Tirar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 flex-1 px-1.5 text-[11px]"
                    disabled={busy}
                    onClick={() => openUpload(slot.id)}
                  >
                    <ImagePlus className="size-3" />
                    Galeria
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
