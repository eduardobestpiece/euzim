"use client";

import type { ReactNode, SyntheticEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AvatarStudySubject = {
  name: string;
  kindLabel: string;
  heroUrl: string | null;
  sheets: { label: string; url: string }[];
};

function blockCopy(e: SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/** Imagem só para visualização  -  bloqueia menu, arraste e seleção. */
function ProtectedImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl"
      onContextMenu={blockCopy}
      onDragStart={blockCopy}
      onCopy={blockCopy}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={`pointer-events-none select-none ${className ?? ""}`}
        style={{
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTouchCallout: "none",
        }}
      />
      {/* Camada transparente impede “Salvar imagem como…” no alvo da img */}
      <div
        className="absolute inset-0 z-[1] cursor-default"
        aria-hidden
        onContextMenu={blockCopy}
        onDragStart={blockCopy}
      />
    </div>
  );
}

function StudySection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <figure className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </figure>
  );
}

export function AvatarStudyDialog({
  open,
  onOpenChange,
  subject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: AvatarStudySubject | null;
}) {
  if (!subject) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto print:hidden sm:max-w-2xl"
        showCloseButton
        onContextMenu={blockCopy}
        onCopy={blockCopy}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Estudo de personagem  -  {subject.name}
          </DialogTitle>
          <DialogDescription>
            {subject.kindLabel}. Folhas em várias poses  -  só visualização (sem
            baixar, copiar ou imprimir).
          </DialogDescription>
        </DialogHeader>

        <div
          className="space-y-4 select-none"
          onContextMenu={blockCopy}
          onCopy={blockCopy}
          style={{ WebkitUserSelect: "none", userSelect: "none" }}
        >
          {subject.heroUrl ? (
            <StudySection label="Retrato">
              <ProtectedImage
                src={subject.heroUrl}
                alt={subject.name}
                className="mx-auto max-h-48 w-auto object-contain"
              />
            </StudySection>
          ) : null}

          {subject.sheets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há folha de poses para este personagem. Regenere o
              avatar Pixar no onboarding se precisar.
            </p>
          ) : (
            subject.sheets.map((sheet) => (
              <StudySection key={sheet.url} label={sheet.label}>
                <ProtectedImage
                  src={sheet.url}
                  alt={`${sheet.label}  -  ${subject.name}`}
                  className="w-full border border-border/60 bg-muted/30 object-contain"
                />
              </StudySection>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
