"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Check, X } from "lucide-react";
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
  friendGuideSrc,
  guideSrc,
  type ChildGender,
} from "@/lib/onboarding/child-profile";

export type SlotPhotos = Record<string, OnboardingPhotoDraft>;

function CameraCaptureDialog({
  open,
  onClose,
  onCaptured,
  onFallbackGallery,
}: {
  open: boolean;
  onClose: () => void;
  onCaptured: (file: File) => void;
  onFallbackGallery: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  const onCloseRef = useRef(onClose);
  const onFallbackRef = useRef(onFallbackGallery);
  onCloseRef.current = onClose;
  onFallbackRef.current = onFallbackGallery;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReady(false);
    setCamError(null);

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError("Câmera não disponível neste aparelho.");
        onFallbackRef.current();
        onCloseRef.current();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setReady(true);
        }
      } catch {
        setCamError("Permissão da câmera negada.");
        onFallbackRef.current();
        onCloseRef.current();
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  function capture() {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement("canvas");
    const w = video.videoWidth || 960;
    const h = video.videoHeight || 1280;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        onCaptured(file);
        onClose();
      },
      "image/jpeg",
      0.92,
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Tirar foto agora</p>
          <button
            type="button"
            aria-label="Fechar"
            className="rounded-md p-1 hover:bg-muted"
            onClick={() => {
              streamRef.current?.getTracks().forEach((t) => t.stop());
              streamRef.current = null;
              onClose();
            }}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="relative aspect-[3/4] bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />
          {!ready ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/90">
              {camError || "Abrindo câmera…"}
            </div>
          ) : null}
        </div>
        <div className="flex gap-2 p-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => {
              streamRef.current?.getTracks().forEach((t) => t.stop());
              streamRef.current = null;
              onFallbackGallery();
              onClose();
            }}
          >
            Usar galeria
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!ready}
            onClick={capture}
          >
            <Camera className="size-3.5" />
            Capturar
          </Button>
        </div>
      </div>
    </div>
  );
}

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
  const [cameraOpen, setCameraOpen] = useState(false);
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
    activeSlotRef.current = slotId;
    setActiveSlot(slotId);
    setCameraOpen(true);
  }

  function openUpload(slotId: string) {
    activeSlotRef.current = slotId;
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
        ref={uploadRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          const slot = activeSlotRef.current || activeSlot;
          if (file && slot) void applyFile(slot, file);
        }}
      />

      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCaptured={(file) => {
          const slot = activeSlotRef.current || activeSlot;
          if (slot) void applyFile(slot, file);
        }}
        onFallbackGallery={() => {
          const slot = activeSlotRef.current || activeSlot;
          if (slot) openUpload(slot);
        }}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {slots.map((slot) => {
          const photo = value[slot.id];
          const label = slotLabel(slot, subject);
          const tip = slotTip(slot, subject);
          const busy = busySlot === slot.id;
          const guide =
            subject === "friend"
              ? friendGuideSrc(slot.id)
              : guideSrc(gender, slot.id);
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
                      ? "Foto anexada. Pode trocar se quiser."
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
