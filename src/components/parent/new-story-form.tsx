"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MagicalLoading } from "@/components/ui/magical-loading";
import {
  LANGUAGE_LEVEL_LABELS,
  LANGUAGE_LEVELS,
  STORY_TYPE_LABELS,
  STORY_TYPES,
  WORD_VOLUME_TARGETS,
  recommendWordVolume,
  type LanguageLevel,
  type StoryType,
  type WordVolume,
} from "@/lib/stories/storyteller-skill";

const THEME_CHIPS = [
  "Vencer o medo de agulha",
  "Vencer o medo de escuro",
  "Aprendendo a dividir",
];

type CharacterOption = {
  id: string;
  name: string;
  isPrimary?: boolean;
  avatarUrl?: string | null;
};

type ClarifyQ = { id: string; prompt: string };

type Step = "theme" | "options" | "clarify" | "generating";

export function NewStoryForm({
  childName,
  friendName,
  remaining,
  characters = [],
  childAgeYears = null,
  onJobQueued,
}: {
  childName?: string | null;
  friendName?: string | null;
  remaining: number;
  characters?: CharacterOption[];
  childAgeYears?: number | null;
  onJobQueued?: (jobId: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("theme");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [theme, setTheme] = useState("");
  const [storyType, setStoryType] = useState<StoryType>("aventura");
  const recommended = recommendWordVolume(childAgeYears);
  const [wordVolume, setWordVolume] = useState<WordVolume>(recommended);
  const [languageLevel, setLanguageLevel] = useState<LanguageLevel>("moderada");
  const [christianValues, setChristianValues] = useState<boolean | null>(null);

  const defaultSelected = useMemo(
    () => new Set(characters.map((c) => c.id)),
    [characters],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(defaultSelected);
  const primaryId =
    characters.find((c) => c.isPrimary)?.id ?? characters[0]?.id ?? "";
  const [protagonistId, setProtagonistId] = useState(primaryId);

  useEffect(() => {
    setSelectedIds(new Set(characters.map((c) => c.id)));
    const nextPrimary =
      characters.find((c) => c.isPrimary)?.id ?? characters[0]?.id ?? "";
    if (nextPrimary) setProtagonistId(nextPrimary);
  }, [characters]);

  const [clarifyQs, setClarifyQs] = useState<ClarifyQ[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string>>(
    {},
  );

  const disabled = remaining <= 0;

  function toggleCharacter(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      if (!next.has(protagonistId)) {
        const first = Array.from(next)[0];
        if (first) setProtagonistId(first);
      }
      return next;
    });
  }

  function goOptions() {
    setError(null);
    if (!theme.trim()) {
      setError("Escreva o tema da história.");
      return;
    }
    setStep("options");
  }

  async function runClarify() {
    setError(null);
    const trimmed = theme.trim();
    if (!trimmed) {
      setError("Escreva o tema ou o desejo da história.");
      return;
    }
    startTransition(async () => {
      try {
        setStatus("Analisando o tema…");
        const selectedNames = characters
          .filter((c) => selectedIds.has(c.id))
          .map((c) => c.name);
        const res = await fetch("/api/stories/clarify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme: trimmed,
            storyType,
            languageLevel,
            castNames: selectedNames,
            protagonistName:
              characters.find((c) => c.id === protagonistId)?.name ??
              childName,
            friendName,
          }),
        });
        const body = (await res.json()) as {
          error?: string;
          needsClarify?: boolean;
          questions?: ClarifyQ[];
        };
        if (!res.ok || body.error) {
          setError(body.error || `Falha (${res.status}).`);
          setStatus(null);
          return;
        }
        if (body.needsClarify && body.questions && body.questions.length > 0) {
          setClarifyQs(body.questions);
          setClarifyAnswers({});
          setStep("clarify");
          setStatus(null);
          return;
        }
        // Sem perguntas — gera direto
        setClarifyQs([]);
        setStatus(null);
        generateStory();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Falha ao analisar o tema.",
        );
        setStatus(null);
      }
    });
  }

  function generateStory() {
    setError(null);
    setStep("generating");
    setStatus("Enfileirando a história…");

    const answersPayload: Record<string, string> = {};
    for (const q of clarifyQs) {
      const a = clarifyAnswers[q.id]?.trim();
      if (a) answersPayload[q.prompt] = a;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/stories/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme: theme.trim(),
            storyType,
            wordVolume,
            wordTarget: WORD_VOLUME_TARGETS[wordVolume].words,
            languageLevel,
            christianValues: Boolean(christianValues),
            answers: answersPayload,
            characterIds: Array.from(selectedIds),
            protagonistId,
          }),
        });
        const body = (await res.json()) as {
          error?: string;
          jobId?: string;
          queued?: boolean;
          storyId?: string;
          redirectTo?: string;
          message?: string;
        };
        if (!res.ok || body.error) {
          setError(body.error || `Falha (${res.status}).`);
          setStatus(null);
          setStep("options");
          return;
        }
        if (body.jobId) {
          setStatus(
            body.message ||
              "História na fila. Pode sair — avisamos quando ficar pronta.",
          );
          onJobQueued?.(body.jobId);
          return;
        }
        window.location.assign(
          body.redirectTo || `/app/parent/stories/${body.storyId}`,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Falha de rede ao gerar a história.",
        );
        setStatus(null);
        setStep("options");
      }
    });
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="size-5 text-amber-700" />
          Nova História
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === "theme" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="theme">Tema</Label>
              <Input
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                required
                disabled={disabled || pending}
                placeholder="Sobre o que é a história?"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {THEME_CHIPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
                  disabled={disabled || pending}
                  onClick={() => setTheme(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <Button
              type="button"
              size="lg"
              className="w-full gap-2"
              disabled={disabled || pending}
              onClick={goOptions}
            >
              Continuar
              <ChevronRight className="size-4" />
            </Button>
          </>
        ) : null}

        {step === "options" ? (
          <>
            {characters.length > 0 ? (
              <div className="space-y-2">
                <Label>Personagens na história</Label>
                <ul className="space-y-2">
                  {characters.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 px-3 py-2"
                    >
                      <label className="flex flex-1 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleCharacter(c.id)}
                        />
                        {c.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.avatarUrl}
                            alt=""
                            className="size-8 rounded-lg object-cover"
                          />
                        ) : null}
                        <span className="font-medium">{c.name}</span>
                        {c.isPrimary ? (
                          <span className="text-[10px] uppercase text-muted-foreground">
                            primário
                          </span>
                        ) : null}
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="radio"
                          name="protagonist"
                          checked={protagonistId === c.id}
                          disabled={!selectedIds.has(c.id)}
                          onChange={() => setProtagonistId(c.id)}
                        />
                        Protagonista
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Tipo de história</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {STORY_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setStoryType(t)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                      storyType === t
                        ? "border-amber-600 bg-amber-50 text-amber-950"
                        : "border-border hover:border-foreground/40"
                    }`}
                  >
                    {STORY_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Linguagem</Label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setLanguageLevel(level)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      languageLevel === level
                        ? "border-amber-600 bg-amber-50 text-amber-950"
                        : "border-border text-muted-foreground hover:border-foreground"
                    }`}
                  >
                    {LANGUAGE_LEVEL_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Tamanho dos textos{" "}
                <span className="font-normal text-muted-foreground">
                  (recomendado: {WORD_VOLUME_TARGETS[recommended].label})
                </span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(WORD_VOLUME_TARGETS) as WordVolume[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setWordVolume(v)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      wordVolume === v
                        ? "border-amber-600 bg-amber-50 text-amber-950"
                        : "border-border text-muted-foreground hover:border-foreground"
                    }`}
                  >
                    {WORD_VOLUME_TARGETS[v].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Incluir princípios cristãos tradicionais?</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setChristianValues(true)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    christianValues === true
                      ? "border-amber-600 bg-amber-50 text-amber-950"
                      : "border-border text-muted-foreground hover:border-foreground"
                  }`}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setChristianValues(false)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    christianValues === false
                      ? "border-amber-600 bg-amber-50 text-amber-950"
                      : "border-border text-muted-foreground hover:border-foreground"
                  }`}
                >
                  Não
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Se sim, valores como amor ao próximo e perdão entram no enredo —
                sem citação bíblica.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("theme")}
                disabled={pending}
              >
                <ChevronLeft className="size-4" />
                Voltar
              </Button>
              <Button
                type="button"
                size="lg"
                className="flex-1 gap-2"
                disabled={disabled || pending || christianValues === null}
                onClick={() => void runClarify()}
              >
                Continuar
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </>
        ) : null}

        {step === "clarify" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Para contar melhor, responda estas perguntas rápidas:
            </p>
            {clarifyQs.map((q) => (
              <div key={q.id} className="space-y-1.5">
                <Label htmlFor={q.id}>{q.prompt}</Label>
                <Input
                  id={q.id}
                  value={clarifyAnswers[q.id] ?? ""}
                  onChange={(e) =>
                    setClarifyAnswers((prev) => ({
                      ...prev,
                      [q.id]: e.target.value,
                    }))
                  }
                  disabled={pending}
                />
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("options")}
                disabled={pending}
              >
                <ChevronLeft className="size-4" />
                Voltar
              </Button>
              <Button
                type="button"
                className="flex-1 gap-2"
                disabled={pending}
                onClick={() => generateStory()}
              >
                <Wand2 className="size-4" />
                Gerar história
              </Button>
            </div>
          </>
        ) : null}

        {step === "generating" ? (
          <MagicalLoading
            status={status}
            messages={[
              "História na fila…",
              "Contador Sábio escrevendo…",
              "Aplicando continuidade visual…",
              "Pintando cena Pixar…",
              "Criando o quiz inteligente…",
              "Pode fechar esta aba — avisamos quando ficar pronta.",
            ]}
          />
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {status && step !== "generating" ? (
          <p className="text-sm text-amber-800" role="status">
            {status}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
