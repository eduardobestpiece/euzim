"use client";

import { useState, useTransition } from "react";
import { Camera, Check, Lock, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  completeOnboardingAction,
  saveChildProfileAction,
  savePhotosMockAction,
  saveSecurityPinAction,
} from "@/lib/auth/actions";
import type { OnboardingPhotoDraft, OnboardingState } from "@/lib/auth/types";

type Step = "pin" | "child" | "photos" | "done";

export function OnboardingWizard({
  initialState,
  mockMode,
}: {
  initialState: OnboardingState | null;
  mockMode: boolean;
}) {
  const [step, setStep] = useState<Step>(() => {
    if (!initialState?.securityPin) return "pin";
    if (!initialState.child) return "child";
    if (!initialState.photos.length) return "photos";
    return "done";
  });
  const [photos, setPhotos] = useState<OnboardingPhotoDraft[]>(
    initialState?.photos ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitPin(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveSecurityPinAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStep("child");
    });
  }

  function submitChild(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveChildProfileAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStep("photos");
    });
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError(null);

    const next: OnboardingPhotoDraft[] = [...photos];
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith("image/")) continue;
      if (next.length >= 8) break;

      const previewUrl = await readAsDataUrl(file);
      const id = crypto.randomUUID();
      next.push({
        id,
        name: file.name,
        previewUrl,
        storagePath: `mock/avatars/${id}/${file.name}`,
      });
    }
    setPhotos(next);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  function persistPhotos() {
    setError(null);
    startTransition(async () => {
      const result = await savePhotosMockAction(photos);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStep("done");
    });
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboardingAction();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div className="space-y-1">
        <p className="font-heading text-3xl font-semibold tracking-tight">
          Bem-vindo ao Estúdio Mágico
        </p>
        <p className="text-muted-foreground">
          Configure o PIN, a primeira criança e as fotos do avatar (simulação
          LoRA).
        </p>
        {mockMode ? (
          <p className="text-sm text-amber-800">
            Modo mock — uploads ficam só no navegador/cookies; nenhum treino
            real.
          </p>
        ) : null}
      </div>

      <ol className="flex gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <StepChip
          active={step === "pin"}
          done={step !== "pin"}
          label="PIN"
          icon={Lock}
        />
        <StepChip
          active={step === "child"}
          done={step === "photos" || step === "done"}
          label="Criança"
          icon={UserRound}
        />
        <StepChip
          active={step === "photos" || step === "done"}
          done={step === "done"}
          label="Fotos"
          icon={Camera}
        />
      </ol>

      {step === "pin" ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>PIN de segurança</CardTitle>
            <CardDescription>
              Usado para proteger a área kids e ações sensíveis.
            </CardDescription>
          </CardHeader>
          <form action={submitPin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">PIN (4–6 dígitos)</Label>
                <Input
                  id="pin"
                  name="pin"
                  inputMode="numeric"
                  pattern="[0-9]{4,6}"
                  maxLength={6}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPin">Confirmar PIN</Label>
                <Input
                  id="confirmPin"
                  name="confirmPin"
                  inputMode="numeric"
                  pattern="[0-9]{4,6}"
                  maxLength={6}
                  required
                  autoComplete="new-password"
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Salvando…" : "Continuar"}
              </Button>
            </CardContent>
          </form>
        </Card>
      ) : null}

      {step === "child" ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Perfil da criança</CardTitle>
            <CardDescription>
              Essa será a estrela das primeiras histórias.
            </CardDescription>
          </CardHeader>
          <form action={submitChild}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Nome</Label>
                <Input
                  id="displayName"
                  name="displayName"
                  required
                  maxLength={80}
                  defaultValue={initialState?.child?.displayName}
                  placeholder="Luiza"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de nascimento (opcional)</Label>
                <Input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  defaultValue={initialState?.child?.birthDate}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    setStep("pin");
                  }}
                >
                  Voltar
                </Button>
                <Button type="submit" disabled={pending} className="flex-1">
                  {pending ? "Salvando…" : "Continuar"}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      ) : null}

      {step === "photos" ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Fotos para o avatar</CardTitle>
            <CardDescription>
              Simulação de coleta para treino LoRA — nenhuma IA é treinada
              nesta fase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label
              htmlFor="photos"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center"
            >
              <Camera className="size-6 text-muted-foreground" />
              <span className="text-sm">
                Clique para adicionar fotos (até 8)
              </span>
              <Input
                id="photos"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
              />
            </Label>

            {photos.length > 0 ? (
              <ul className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <li
                    key={photo.id}
                    className="relative overflow-hidden rounded-md"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt={photo.name}
                      className="aspect-square w-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white"
                      onClick={() => removePhoto(photo.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError(null);
                  setStep("child");
                }}
              >
                Voltar
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={pending}
                onClick={persistPhotos}
              >
                {pending ? "Salvando…" : "Salvar fotos"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "done" ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="size-5 text-emerald-600" />
              Tudo pronto
            </CardTitle>
            <CardDescription>
              PIN, perfil e fotos configurados. Entre na área dos pais.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <Button className="w-full" disabled={pending} onClick={finish}>
              {pending ? "Abrindo…" : "Ir para área dos pais"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StepChip({
  label,
  active,
  done,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  done: boolean;
  icon: typeof Lock;
}) {
  return (
    <li
      className={`flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-2 ${
        active
          ? "border-foreground text-foreground"
          : done
            ? "border-emerald-600/40 text-emerald-700"
            : "border-transparent bg-muted/50"
      }`}
    >
      <Icon className="size-3.5" />
      {label}
    </li>
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
