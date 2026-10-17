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

export function WallpaperDialog({
  imageUrl,
  title,
}: {
  imageUrl: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function download(format: "png" | "jpeg") {
    setBusy(true);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível");
      ctx.drawImage(bitmap, 0, 0);
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const dataUrl = canvas.toDataURL(mime, 0.92);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${title.replace(/[^\w\-]+/g, "_").slice(0, 40) || "wallpaper"}.${format === "png" ? "png" : "jpg"}`;
      a.click();
    } catch {
      // fallback: open image
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
        onClick={() => setOpen(true)}
      >
        <ImageIcon className="size-3.5" />
        Usar como wallpaper
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[95vh] overflow-hidden border-0 bg-black/95 p-0 text-white sm:max-w-4xl">
          <DialogHeader className="px-4 pt-4 text-left">
            <DialogTitle>Wallpaper</DialogTitle>
            <DialogDescription className="text-white/70">
              Baixe a última ilustração da história em tela cheia.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[70vh] items-center justify-center bg-black px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`Wallpaper — ${title}`}
              className="max-h-[70vh] w-full object-contain"
            />
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
              Baixar PNG
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
              Baixar JPEG
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
