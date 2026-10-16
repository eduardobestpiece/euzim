"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Camera,
  Check,
  Heart,
  Lock,
  PawPrint,
  Sparkles,
  ToyBrick,
  UserRound,
} from "lucide-react";
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
  PhotoSlotGrid,
  type SlotPhotos,
} from "@/components/onboarding/photo-slot-grid";
import {
  finishAvatarOnboardingAction,
  generateAvatarsAction,
  saveChildAvatarProfileAction,
  saveFriendProfileAction,
  saveOnboardingPinAction,
  saveSubjectPhotosAction,
} from "@/lib/onboarding/actions";
import { REQUIRED_PHOTO_COUNT } from "@/lib/onboarding/photo-slots";
import type { OnboardingState } from "@/lib/auth/types";

type Step =
  | "welcome"
  | "pin"
  | "child"
  | "child-photos"
  | "friend"
  | "friend-photos"
  | "generating"
  | "preview";

const STEPS: { id: Step; label: string }[] = [
  { id: "welcome", label: "Olá" },
  { id: "pin", label: "PIN" },
  { id: "child", label: "Filho" },
  { id: "child-photos", label: "Fotos" },
  { id: "friend", label: "Amigo" },
  { id: "friend-photos", label: "Fotos" },
  { id: "generating", label: "Magia" },
  { id: "preview", label: "Pronto" },
];

function photosToMap(
  photos: OnboardingState["childPhotos"] | undefined,
): SlotPhotos {
  const map: SlotPhotos = {};
  for (const p of photos ?? []) {
    if (p.slotId) map[p.slotId] = p;
  }
  return map;
}

export function OnboardingWizard({
  initialState,
  mockMode,
  resetMode = null,
}: {
  initialState: OnboardingState | null;
  mockMode: boolean;
  resetMode?: "full" | "reuse" | null;
}) {
  const isReuse = resetMode === "reuse";
  const [step, setStep] = useState<Step>(() => {
    if (
      isReuse &&
      initialState?.childAvatarUrl &&
      initialState?.friendAvatarUrl
    ) {
      return "preview";
    }
    if (isReuse && initialState?.child?.displayName) return "child";
    return "welcome";
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [childPhotos, setChildPhotos] = useState<SlotPhotos>(() =>
    photosToMap(initialState?.childPhotos ?? initialState?.photos),
  );
  const [friendPhotos, setFriendPhotos] = useState<SlotPhotos>(() =>
    photosToMap(initialState?.friendPhotos),
  );
  const [childName, setChildName] = useState(
    initialState?.child?.displayName ?? "",
  );
  const [friendName, setFriendName] = useState(
    initialState?.friend?.displayName ?? "",
  );
  const [friendKind, setFriendKind] = useState<"pet" | "toy">(
    initialState?.friend?.kind ?? "pet",
  );
  const [childAvatarUrl, setChildAvatarUrl] = useState<string | null>(
    initialState?.childAvatarUrl ?? null,
  );
  const [friendAvatarUrl, setFriendAvatarUrl] = useState<string | null>(
    initialState?.friendAvatarUrl ?? null,
  );
  const [engine, setEngine] = useState<string | null>(
    isReuse ? "reuse" : null,
  );

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const childFilled = useMemo(
    () => Object.keys(childPhotos).length,
    [childPhotos],
  );
  const friendFilled = useMemo(
    () => Object.keys(friendPhotos).length,
    [friendPhotos],
  );

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  function submitPin(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveOnboardingPinAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      go("child");
    });
  }

  function submitChild(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveChildAvatarProfileAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setChildName(String(formData.get("displayName") ?? ""));
      go("child-photos");
    });
  }

  function persistChildPhotos() {
    setError(null);
    if (!isReuse && childFilled < REQUIRED_PHOTO_COUNT) {
      setError(
        `Preencha todos os ${REQUIRED_PHOTO_COUNT} slots da criança (${REQUIRED_PHOTO_COUNT - childFilled} faltando).`,
      );
      return;
    }
    startTransition(async () => {
      if (childFilled > 0) {
        const result = await saveSubjectPhotosAction({
          subject: "child",
          photos: Object.values(childPhotos),
          allowPartial: isReuse,
        });
        if (result.error && !isReuse) {
          setError(result.error);
          return;
        }
      }
      go("friend");
    });
  }

  function submitFriend(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveFriendProfileAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setFriendName(String(formData.get("displayName") ?? ""));
      setFriendKind(
        String(formData.get("kind") ?? "pet") === "toy" ? "toy" : "pet",
      );
      go("friend-photos");
    });
  }

  function persistFriendPhotos() {
    setError(null);
    if (!isReuse && friendFilled < REQUIRED_PHOTO_COUNT) {
      setError(
        `Preencha todos os ${REQUIRED_PHOTO_COUNT} slots do amigo (${REQUIRED_PHOTO_COUNT - friendFilled} faltando).`,
      );
      return;
    }
    startTransition(async () => {
      if (friendFilled > 0) {
        const result = await saveSubjectPhotosAction({
          subject: "friend",
          photos: Object.values(friendPhotos),
          allowPartial: isReuse,
        });
        if (result.error && !isReuse) {
          setError(result.error);
          return;
        }
      }
      if (isReuse && childAvatarUrl && friendAvatarUrl) {
        go("preview");
        return;
      }
      go("generating");
      const gen = await generateAvatarsAction();
      if (gen.error) {
        setError(gen.error);
        setStep("friend-photos");
        return;
      }
      setChildAvatarUrl(gen.childAvatarUrl ?? null);
      setFriendAvatarUrl(gen.friendAvatarUrl ?? null);
      setEngine(gen.engine ?? null);
      go("preview");
    });
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const result = await finishAvatarOnboardingAction();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 pb-10">
      <header className="space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-900">
          <Sparkles className="size-3.5" />
          Estúdio Mágico
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {isReuse
            ? "Revisar experiência do avatar"
            : "Crie o avatar da sua criança"}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {isReuse
            ? "Seus materiais foram mantidos. Confira fotos e preview — depois liberamos o painel de novo."
            : "Antes das histórias, vamos construir os personagens mágicos com fotos guiadas."}
        </p>
        {mockMode ? (
          <p className="text-xs text-amber-800">
            Modo local — uploads podem ficar só no dispositivo se o Storage
            falhar.
          </p>
        ) : null}
      </header>

      <ol className="flex gap-1 overflow-x-auto pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            className={`shrink-0 rounded-md px-2 py-1.5 ${
              i === stepIndex
                ? "bg-foreground text-background"
                : i < stepIndex
                  ? "bg-emerald-600/15 text-emerald-800"
                  : "bg-muted/60"
            }`}
          >
            {s.label}
          </li>
        ))}
      </ol>

      {step === "welcome" ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>{isReuse ? "Bem-vindo de volta" : "Bem-vindo"}</CardTitle>
            <CardDescription>
              {isReuse
                ? "Vamos revisar o avatar e o melhor amigo já criados."
                : "Em poucos minutos você cria o avatar do seu filho e do melhor amigo (pet ou brinquedo). Só depois liberamos a primeira história."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" size="lg" onClick={() => go("pin")}>
              {isReuse ? "Revisar" : "Começar"}
            </Button>
            {isReuse && childAvatarUrl && friendAvatarUrl ? (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => go("preview")}
              >
                Ir ao preview salvo
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === "pin" ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-4" />
              PIN dos pais
            </CardTitle>
            <CardDescription>
              Protege a troca Kids ↔ Pais. Rápido — depois focamos no avatar.
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
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => go("welcome")}
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

      {step === "child" ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4" />
              Avatar do filho
            </CardTitle>
            <CardDescription>
              Nome e idade — a estrela das aventuras.
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
                  defaultValue={childName}
                  placeholder="Luiza"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ageYears">Idade</Label>
                <Input
                  id="ageYears"
                  name="ageYears"
                  type="number"
                  min={1}
                  max={17}
                  required
                  defaultValue={initialState?.child?.ageYears ?? ""}
                  placeholder="6"
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => go("pin")}
                >
                  Voltar
                </Button>
                <Button type="submit" disabled={pending} className="flex-1">
                  {pending ? "Salvando…" : "Ir para as fotos"}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      ) : null}

      {step === "child-photos" ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="size-4" />
              12 fotos de {childName || "sua criança"}
            </CardTitle>
            <CardDescription>
              6 do rosto + 6 do corpo. Tire agora ou envie da galeria — cada
              slot tem a pose certa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PhotoSlotGrid
              subject="child"
              value={childPhotos}
              onChange={setChildPhotos}
            />
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => go("child")}
              >
                Voltar
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={
                  pending ||
                  (!isReuse && childFilled < REQUIRED_PHOTO_COUNT)
                }
                onClick={persistChildPhotos}
              >
                {pending
                  ? "Salvando…"
                  : !isReuse && childFilled < REQUIRED_PHOTO_COUNT
                    ? `Faltam ${REQUIRED_PHOTO_COUNT - childFilled}`
                    : "Continuar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "friend" ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="size-4" />
              Melhor amigo
            </CardTitle>
            <CardDescription>
              Pet ou brinquedo favorito — entra nas histórias junto.
            </CardDescription>
          </CardHeader>
          <form action={submitFriend}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 ${
                    friendKind === "pet"
                      ? "border-foreground"
                      : "border-border/70"
                  }`}
                >
                  <input
                    type="radio"
                    name="kind"
                    value="pet"
                    className="sr-only"
                    checked={friendKind === "pet"}
                    onChange={() => setFriendKind("pet")}
                  />
                  <PawPrint className="size-5" />
                  <span className="text-sm font-medium">Pet</span>
                </label>
                <label
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 ${
                    friendKind === "toy"
                      ? "border-foreground"
                      : "border-border/70"
                  }`}
                >
                  <input
                    type="radio"
                    name="kind"
                    value="toy"
                    className="sr-only"
                    checked={friendKind === "toy"}
                    onChange={() => setFriendKind("toy")}
                  />
                  <ToyBrick className="size-5" />
                  <span className="text-sm font-medium">Brinquedo</span>
                </label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="friendName">Nome</Label>
                <Input
                  id="friendName"
                  name="displayName"
                  required
                  maxLength={80}
                  defaultValue={friendName}
                  placeholder={friendKind === "pet" ? "Thor" : "Ursinho"}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => go("child-photos")}
                >
                  Voltar
                </Button>
                <Button type="submit" disabled={pending} className="flex-1">
                  {pending ? "Salvando…" : "Fotos do amigo"}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      ) : null}

      {step === "friend-photos" ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="size-4" />
              12 fotos de {friendName || "melhor amigo"}
            </CardTitle>
            <CardDescription>
              Mesmas 12 poses, com guia adaptada para{" "}
              {friendKind === "pet" ? "pet" : "brinquedo"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PhotoSlotGrid
              subject="friend"
              value={friendPhotos}
              onChange={setFriendPhotos}
            />
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => go("friend")}
              >
                Voltar
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={
                  pending ||
                  (!isReuse && friendFilled < REQUIRED_PHOTO_COUNT)
                }
                onClick={persistFriendPhotos}
              >
                {pending
                  ? "Gerando avatares…"
                  : !isReuse && friendFilled < REQUIRED_PHOTO_COUNT
                    ? `Faltam ${REQUIRED_PHOTO_COUNT - friendFilled}`
                    : isReuse && childAvatarUrl
                      ? "Continuar com avatares salvos"
                      : "Gerar personagens"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "generating" ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Sparkles className="size-8 animate-pulse text-amber-600" />
            <div className="space-y-1">
              <p className="font-heading text-xl font-semibold">
                Criando magia…
              </p>
              <p className="text-sm text-muted-foreground">
                Treino LoRA simulado + preview Disney-like dos personagens.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "preview" ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="size-5 text-emerald-600" />
              Seus avatares
            </CardTitle>
            <CardDescription>
              Preview pronto
              {engine ? ` (${engine})` : ""}. Agora sim — primeira história
              liberada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <figure className="space-y-2">
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-amber-50 to-sky-50 shadow-sm">
                  {childAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={childAvatarUrl}
                      alt={childName}
                      className="aspect-square w-full object-cover"
                    />
                  ) : null}
                </div>
                <figcaption className="text-center text-sm font-medium">
                  {childName}
                </figcaption>
              </figure>
              <figure className="space-y-2">
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-rose-50 to-violet-50 shadow-sm">
                  {friendAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={friendAvatarUrl}
                      alt={friendName}
                      className="aspect-square w-full object-cover"
                    />
                  ) : null}
                </div>
                <figcaption className="text-center text-sm font-medium">
                  {friendName}{" "}
                  <span className="text-muted-foreground">
                    ({friendKind === "pet" ? "pet" : "brinquedo"})
                  </span>
                </figcaption>
              </figure>
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <Button
              className="w-full"
              size="lg"
              disabled={pending}
              onClick={finish}
            >
              {pending ? "Abrindo painel…" : "Criar primeira história"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
