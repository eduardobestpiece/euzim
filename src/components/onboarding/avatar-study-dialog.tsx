"use client";

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
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Estudo de personagem — {subject.name}
          </DialogTitle>
          <DialogDescription>
            {subject.kindLabel}. Folhas em várias poses — base para as próximas
            histórias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {subject.heroUrl ? (
            <figure className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Retrato
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={subject.heroUrl}
                alt={subject.name}
                className="mx-auto max-h-48 rounded-xl object-contain"
              />
            </figure>
          ) : null}

          {subject.sheets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há folha de poses para este personagem. Use Regenerar
              Pixar no passo Pronto.
            </p>
          ) : (
            subject.sheets.map((sheet) => (
              <figure key={sheet.url} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {sheet.label}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sheet.url}
                  alt={`${sheet.label} — ${subject.name}`}
                  className="w-full rounded-xl border border-border/60 bg-muted/30 object-contain"
                />
              </figure>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
