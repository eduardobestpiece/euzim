"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  requiredPhotoCount,
  slotsForSubject,
  slotLabel,
  slotTip,
  type PhotoSubject,
} from "@/lib/onboarding/photo-slots";
import type { OnboardingPhotoDraft } from "@/lib/auth/types";
import {
  attachedPlaceholderDataUrl,
  compressImageForUpload,
  isRealPhotoPreview,
} from "@/lib/onboarding/compress-image";
import {
  guideSrc,
  type ChildGender,
} from "@/lib/onboarding/child-profile";

export type SlotPhotos = Record<string, OnboardingPhotoDraft>;

export function PhotoSlotGrid({
  subject,
  value,
  onChange,
  gender = "other",
}: {
  subject: PhotoSubject;
  value: SlotPhotos;
  onChange: (next: SlotPhotos) => void;
  gender?: ChildGender | null;
}) {
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<string | null>(
    () => slotsForSubject(subject)[0]?.id ?? null,
  );
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const activeSlotRef = useRef<string | null>(null);

  const slots = slotsForSubject(subject);
  const required = requiredPhotoCount(subject);
  const filled = Object.keys(value).length;
  const missing = required - filled;

  async function applyFile(slotId: string, file: File) {
    setBusySlot(slotId);
    setError(null);

    try {
      const { file: compressed, previewUrl: clientPreview } =
        await compressImageForUpload(file);

      // Anexa já (conta no progresso). Preview real se o canvas conseguiu;
      // senão fica pendente até o servidor devolver JPEG.
      const draft: OnboardingPhotoDraft = {
        id: crypto.randomUUID(),
        slotId,
        name: compressed.name,
        previewUrl: isRealPhotoPreview(clientPreview) ? clientPreview : "",
        storagePath: `pending/${slotId}`,
      };
      onChange({ ...valueRef.current, [slotId]: draft });

      const fd = new FormData();
      fd.set("slotId", slotId);
      fd.set("subject", subject);
      fd.set("file", compressed);

      const res = await fetch("/api/onboarding/upload-photo", {
        method: "POST",
        body: fd,
      });

      let result: {
        error?: string;
        warning?: string;
        storagePath?: string;
        publicUrl?: string;
        previewUrl?: string;
        previewDataUrl?: string;
      } = {};
      try {
        result = (await res.json()) as typeof result;
      } catch {
        result = { error: `Falha no upload (${res.status}).` };
      }

      const serverPreview =
        result.previewDataUrl ||
        (result.previewUrl && isRealPhotoPreview(result.previewUrl)
          ? result.previewUrl
          : undefined);

      // Sempre preferir JPEG do servidor (foto real). Fallback: canvas local.
      const nextPreview =
        serverPreview ||
        (isRealPhotoPreview(draft.previewUrl) ? draft.previewUrl : "") ||
        (isRealPhotoPreview(clientPreview) ? clientPreview : "") ||
        attachedPlaceholderDataUrl();

      if (!res.ok && !result.storagePath) {
        setError(
          result.error ||
            "Não foi possível enviar ao servidor, mas a foto ficou anexada neste aparelho.",
        );
        onChange({
          ...valueRef.current,
          [slotId]: {
            ...draft,
            previewUrl: nextPreview,
            storagePath: `local/${slotId}`,
          },
        });
        return;
      }

      onChange({
        ...valueRef.current,
        [slotId]: {
          ...draft,
          previewUrl: nextPreview,
          storagePath: result.storagePath || `local/${slotId}`,
          publicUrl: result.publicUrl,
        },
      });

      if (!isRealPhotoPreview(nextPreview)) {
        setError(
          "Foto recebida, mas o preview não pôde ser gerado. Tente JPG/PNG ou outra da galeria.",
        );
      }

      if (result.warning) {
        setError(result.warning);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Não foi possível enviar a foto.";
      if (/Body exceeded|1 MB|body size|413/i.test(message)) {
        setError(
          "A foto é grande demais. Tente outra da galeria ou tire de novo com menos zoom.",
        );
      } else {
        setError(message);
      }
    } finally {
      setBusySlot(null);
    }
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
          {filled}/{required} fotos
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
        accept="image/*,.heic,.heif"
        capture="user"
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
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && activeSlot) void applyFile(activeSlot, file);
        }}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {slots.map((slot) => {
          const photo = value[slot.id];
          const label = slotLabel(slot, subject);
          const tip = slotTip(slot, subject);
          const busy = busySlot === slot.id;
          const guide = guideSrc(gender, slot.id);
          const hasRealPreview = Boolean(
            photo && isRealPhotoPreview(photo.previewUrl),
          );
          return (
            <div
              key={slot.id}
              className={`overflow-hidden rounded-2xl border ${
                photo
                  ? "border-emerald-600/50 bg-emerald-50/30"
                  : "border-border/70"
              }`}
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-[#EDE8E0]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={guide}
                  alt=""
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-cover object-top transition ${
                    hasRealPreview ? "opacity-0" : "opacity-100"
                  }`}
                />
                {hasRealPreview && photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={photo.id}
                    src={photo.previewUrl}
                    alt={label}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                {!photo ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 pb-3 pt-10">
                    <p className="text-xs font-semibold text-white">{label}</p>
                    <p className="text-[11px] text-white/85">{tip}</p>
                  </div>
                ) : null}
                {photo && hasRealPreview && !busy ? (
                  <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md bg-emerald-700 px-2 py-1 text-[11px] font-semibold text-white shadow">
                    <Check className="size-3" />
                    Anexada
                  </div>
                ) : null}
                {busy || (photo && !hasRealPreview) ? (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/45 px-4 text-center text-xs text-white">
                    <span className="font-semibold">
                      {busy ? "Convertendo e enviando…" : "Gerando preview…"}
                    </span>
                    <span className="text-white/80">A foto real aparece aqui</span>
                  </div>
                ) : null}
              </div>
              <div className="space-y-2 p-3">
                <div>
                  <p className="text-sm font-semibold leading-tight">{label}</p>
                  <p className="text-xs leading-snug text-muted-foreground">
                    {hasRealPreview
                      ? "Foto anexada — pode trocar se quiser."
                      : photo
                        ? "Recebendo preview da foto…"
                        : tip}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 flex-1"
                    disabled={busy}
                    onClick={() => openCamera(slot.id)}
                  >
                    <Camera className="size-3.5" />
                    {photo ? "Tirar de novo" : "Tirar agora"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-9 flex-1"
                    disabled={busy}
                    onClick={() => openUpload(slot.id)}
                  >
                    <ImagePlus className="size-3.5" />
                    {photo ? "Trocar" : "Galeria"}
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
