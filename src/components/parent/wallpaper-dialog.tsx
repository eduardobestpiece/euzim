"use client";

import { useState } from "react";
import { Download, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

export function WallpaperDialog({
  imageUrl,
  title,
}: {
  imageUrl: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function buildPhoneCanvas(): Promise<HTMLCanvasElement> {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = PHONE_W;
    canvas.height = PHONE_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");

    // Fundo desfocado suave (preenche bordas se a arte for landscape)
    ctx.filter = "blur(28px) saturate(1.1)";
    coverDraw(ctx, bitmap, PHONE_W, PHONE_H);
    ctx.filter = "none";
    // Camada principal em cover
    coverDraw(ctx, bitmap, PHONE_W, PHONE_H);
    return canvas;
  }

  async function ensurePreview() {
    if (previewUrl) return;
    try {
      const canvas = await buildPhoneCanvas();
      setPreviewUrl(canvas.toDataURL("image/jpeg", 0.9));
    } catch {
      setPreviewUrl(imageUrl);
    }
  }

  async function download(format: "png" | "jpeg") {
    setBusy(true);
    try {
      const canvas = await buildPhoneCanvas();
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const dataUrl = canvas.toDataURL(mime, 0.92);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${title.replace(/[^\w\-]+/g, "_").slice(0, 40) || "wallpaper"}-phone.${format === "png" ? "png" : "jpg"}`;
      a.click();
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        onClick={() => {
          setOpen(true);
          void ensurePreview();
        }}
      >
        <ImageIcon className="size-3.5" />
        Usar como wallpaper
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[95vh] overflow-hidden border-0 bg-zinc-950 p-0 text-white sm:max-w-lg">
          <DialogHeader className="px-4 pt-4 text-left">
            <DialogTitle>Wallpaper do celular</DialogTitle>
            <DialogDescription className="text-white/70">
              Formato retrato 9:19.5 (1080×2340) — upscale da arte da história para
              a tela do celular.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[65vh] items-center justify-center bg-black px-4 py-2">
            <div className="relative aspect-[9/19.5] h-[min(65vh,560px)] overflow-hidden rounded-[1.75rem] border-[3px] border-zinc-600 bg-black shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl || imageUrl}
                alt={`Wallpaper — ${title}`}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-4">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              className="gap-1.5"
              onClick={() => void download("png")}
            >
              <Download className="size-3.5" />
              Baixar PNG celular
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              className="gap-1.5"
              onClick={() => void download("jpeg")}
            >
              <Download className="size-3.5" />
              Baixar JPEG celular
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
