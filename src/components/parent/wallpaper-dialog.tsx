"use client";

import { useState, type CSSProperties } from "react";
import { Download, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Formato típico de tela de celular (9:19.5 ≈ iPhone). */
const PHONE_W = 1080;
const PHONE_H = 2340;

function coverDraw(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  cw: number,
  ch: number,
) {
  const scale = Math.max(cw / bitmap.width, ch / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  const x = (cw - w) / 2;
  const y = (ch - h) / 2;
  ctx.drawImage(bitmap, x, y, w, h);
}

function safeFilename(title: string, suffix: string) {
  const base =
    title.replace(/[^\w\-]+/g, "_").slice(0, 40) || "wallpaper";
  return `${base}-${suffix}`;
}

async function fetchImageBlob(imageUrl: string): Promise<Blob> {
  const res = await fetch(imageUrl, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function WallpaperDialog({
  imageUrl,
  title,
  triggerLabel = "Wallpaper",
  triggerClassName,
  triggerStyle,
  size = "sm",
  variant = "secondary",
}: {
  imageUrl: string;
  title: string;
  triggerLabel?: string;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  size?: "sm" | "default" | "lg" | "icon";
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "ghost"
    | "destructive"
    | "link";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!imageUrl) return null;

  async function buildPhoneCanvas(): Promise<HTMLCanvasElement> {
    const blob = await fetchImageBlob(imageUrl);
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = PHONE_W;
    canvas.height = PHONE_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");

    ctx.filter = "blur(28px) saturate(1.1)";
    coverDraw(ctx, bitmap, PHONE_W, PHONE_H);
    ctx.filter = "none";
    coverDraw(ctx, bitmap, PHONE_W, PHONE_H);
    bitmap.close();
    return canvas;
  }

  async function ensurePreview() {
    if (previewUrl) return;
    try {
      const canvas = await buildPhoneCanvas();
      setPreviewUrl(canvas.toDataURL("image/jpeg", 0.9));
      setError(null);
    } catch {
      // Preview direto da arte portrait (já 1024×1536)
      setPreviewUrl(imageUrl);
    }
  }

  async function downloadOriginal() {
    setBusy(true);
    setError(null);
    try {
      const blob = await fetchImageBlob(imageUrl);
      const ext = blob.type.includes("png") ? "png" : "jpg";
      triggerBlobDownload(blob, safeFilename(title, `wallpaper.${ext}`));
    } catch {
      // Fallback: abrir a arte original numa aba
      window.open(imageUrl, "_blank", "noopener,noreferrer");
      setError("Abra a imagem e salve no celular (toque longo → salvar).");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPhone(format: "png" | "jpeg") {
    setBusy(true);
    setError(null);
    try {
      const canvas = await buildPhoneCanvas();
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob falhou"))),
          mime,
          0.92,
        );
      });
      triggerBlobDownload(
        blob,
        safeFilename(title, `phone.${format === "png" ? "png" : "jpg"}`),
      );
    } catch {
      await downloadOriginal();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("gap-1.5", triggerClassName)}
        style={triggerStyle}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
          void ensurePreview();
        }}
      >
        <ImageIcon className="size-3.5" />
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[95vh] overflow-hidden border-0 bg-zinc-950 p-0 text-white sm:max-w-lg">
          <DialogHeader className="px-4 pt-4 text-left">
            <DialogTitle>Wallpaper do celular</DialogTitle>
            <DialogDescription className="text-white/70">
              Última página em retrato (1024×1536). O quadro central (~16:10) é o
              da leitura; o resto completa o wallpaper.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[65vh] items-center justify-center bg-black px-4 py-2">
            <div className="relative aspect-[9/19.5] h-[min(65vh,560px)] overflow-hidden rounded-[1.75rem] border-[3px] border-zinc-600 bg-black shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl || imageUrl}
                alt={`Wallpaper — ${title}`}
                className="h-full w-full object-cover"
                crossOrigin="anonymous"
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 border border-dashed border-amber-300/70"
                style={{ height: "42%" }}
                aria-hidden
              />
              <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[10px] font-medium text-amber-100/90">
                Faixa central = quadro da história
              </p>
            </div>
          </div>
          {error ? (
            <p className="px-4 text-xs text-amber-200" role="status">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 px-4 py-4">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              className="gap-1.5"
              onClick={() => void downloadOriginal()}
            >
              <Download className="size-3.5" />
              Baixar retrato original
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              className="gap-1.5"
              onClick={() => void downloadPhone("jpeg")}
            >
              <Download className="size-3.5" />
              Baixar JPEG celular
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              className="gap-1.5 border-white/30 bg-transparent text-white hover:bg-white/10"
              onClick={() => void downloadPhone("png")}
            >
              <Download className="size-3.5" />
              Baixar PNG celular
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-white/80 hover:bg-white/10 hover:text-white"
              onClick={() =>
                window.open(imageUrl, "_blank", "noopener,noreferrer")
              }
            >
              Abrir imagem
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
