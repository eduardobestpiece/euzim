"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Sparkles,
  UserPlus,
  Camera,
  PawPrint,
  Wand2,
  BookOpen,
} from "lucide-react";
import { InlineBrand } from "@/components/brand/inline-brand";
import { cn } from "@/lib/utils";

const SERENA_PHOTOS = [
  "/demo/roadmap/serena/photo-1.jpg",
  "/demo/roadmap/serena/photo-2.jpg",
  "/demo/roadmap/serena/photo-3.jpg",
  "/demo/roadmap/serena/photo-4.jpg",
] as const;

const BINGO_PHOTOS = [
  "/demo/roadmap/bingo/photo-1.jpg",
  "/demo/roadmap/bingo/photo-2.jpg",
  "/demo/roadmap/bingo/photo-3.jpg",
  "/demo/roadmap/bingo/photo-4.jpg",
] as const;

const THEME_FULL = "Vencer o medo de agulha";
const AI_MESSAGES = [
  "Contador Sábio escrevendo…",
  "Tecendo diálogos mágicos…",
  "Pintando cenas Pixar…",
  "Polindo a moral com carinho…",
  "Quase pronto…",
] as const;

function PhotoGrid({
  photos,
  label,
}: {
  photos: readonly string[];
  label: string;
}) {
  return (
    <div className="landing-roadmap-photos" aria-label={label}>
      {photos.map((src, i) => (
        <figure
          key={src}
          className="landing-roadmap-photo"
          style={{ animationDelay: `${i * 120}ms` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`${label} ${i + 1}`} draggable={false} />
          <span className="landing-roadmap-photo-check" aria-hidden>
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        </figure>
      ))}
    </div>
  );
}

function SignupMock() {
  return (
    <div className="landing-roadmap-signup">
      <div className="landing-roadmap-signup-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/euzim-logo-color.png"
          alt=""
          className="h-8 w-auto object-contain"
        />
        <p className="font-story-body text-xs text-[var(--euzim-ink-soft)]">
          Crie sua conta em segundos
        </p>
      </div>
      <div className="space-y-2.5">
        <div className="landing-roadmap-field">
          <span>Nome</span>
          <strong>Eduardo</strong>
        </div>
        <div className="landing-roadmap-field">
          <span>E-mail</span>
          <strong>eduardo@email.com</strong>
        </div>
        <div className="landing-roadmap-field">
          <span>Senha</span>
          <strong>••••••••</strong>
        </div>
      </div>
      <div className="landing-roadmap-signup-cta">Criar conta</div>
    </div>
  );
}

function ThemeTypingMock() {
  const [typed, setTyped] = useState("");
  const [chipPulse, setChipPulse] = useState(false);

  useEffect(() => {
    let i = 0;
    let typeId = 0;
    let pauseId = 0;
    let cancelled = false;

    const startTyping = () => {
      if (cancelled) return;
      setChipPulse(false);
      setTyped("");
      i = 0;
      typeId = window.setInterval(() => {
        if (cancelled) return;
        i += 1;
        setTyped(THEME_FULL.slice(0, i));
        if (i >= THEME_FULL.length) {
          window.clearInterval(typeId);
          setChipPulse(true);
          pauseId = window.setTimeout(startTyping, 2200);
        }
      }, 55);
    };

    startTyping();
    return () => {
      cancelled = true;
      window.clearInterval(typeId);
      window.clearTimeout(pauseId);
    };
  }, []);

  return (
    <div className="landing-roadmap-theme">
      <div className="landing-roadmap-avatars">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo/roadmap/avatars/serena.jpg" alt="Avatar Serena" />
          <figcaption>Serena</figcaption>
        </figure>
        <span className="landing-roadmap-avatars-plus" aria-hidden>
          +
        </span>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo/roadmap/avatars/bingo.jpg" alt="Avatar Bingo" />
          <figcaption>Bingo</figcaption>
        </figure>
      </div>

      <div className="landing-roadmap-theme-card">
        <div className="landing-roadmap-theme-title">
          <Wand2 className="size-4 text-[var(--euzim-violet)]" />
          <span className="font-heading font-semibold">Nova História</span>
        </div>
        <label className="landing-roadmap-theme-label">Tema</label>
        <div className="landing-roadmap-theme-input" aria-live="polite">
          <span>{typed}</span>
          <span className="landing-roadmap-caret" aria-hidden />
        </div>
        <div className="landing-roadmap-chips">
          {["Vencer o medo de agulha", "Vencer o medo de escuro", "Aprendendo a dividir"].map(
            (chip) => (
              <span
                key={chip}
                className={cn(
                  "landing-roadmap-chip",
                  chipPulse && chip === THEME_FULL && "is-active",
                )}
              >
                {chip}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function AiWorkingMock() {
  const [msg, setMsg] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setMsg((m) => (m + 1) % AI_MESSAGES.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="landing-roadmap-ai">
      <div className="landing-roadmap-ai-orbit" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="landing-roadmap-ai-core">
        <Sparkles className="size-7 animate-spin [animation-duration:3.2s]" />
      </div>
      <p className="font-heading text-sm font-semibold text-amber-950 sm:text-base">
        {AI_MESSAGES[msg]}
      </p>
      <div className="landing-roadmap-ai-frames" aria-hidden>
        <div className="landing-roadmap-ai-frame is-a" />
        <div className="landing-roadmap-ai-frame is-b" />
        <div className="landing-roadmap-ai-frame is-c" />
      </div>
      <p className="text-xs text-amber-900/70">
        A Euzim escreve, ilustra e monta o livro completo por você.
      </p>
    </div>
  );
}

function BookCoversMock() {
  return (
    <div className="landing-roadmap-covers">
      <figure className="landing-roadmap-cover is-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo/roadmap/covers/agulha.jpg"
          alt="Capa Serena e o Medo da Agulha"
        />
        <figcaption>
          Serena e o Medo
          <br />
          da Agulha
        </figcaption>
      </figure>
      <figure className="landing-roadmap-cover is-right">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo/roadmap/covers/compaixao.jpg"
          alt="Capa Serena e a Luz da Compaixão"
        />
        <figcaption>
          Serena e a Luz
          <br />
          da Compaixão
        </figcaption>
      </figure>
    </div>
  );
}

const STEPS: {
  n: number;
  title: string;
  Icon: typeof UserPlus;
  visual: "signup" | "serena" | "bingo" | "theme" | "ai" | "covers";
}[] = [
  {
    n: 1,
    title: "Faça o seu cadastro na euzim",
    Icon: UserPlus,
    visual: "signup",
  },
  {
    n: 2,
    title: "Envie fotos da sua criança para criar o avatar",
    Icon: Camera,
    visual: "serena",
  },
  {
    n: 3,
    title: "Envie fotos do pet ou do brinquedo favorito da sua criança",
    Icon: PawPrint,
    visual: "bingo",
  },
  {
    n: 4,
    title: "Agora com avatar gerado, dê um tema para a sua história",
    Icon: Wand2,
    visual: "theme",
  },
  {
    n: 5,
    title: "Aguarde a Euzim gerar a história",
    Icon: Sparkles,
    visual: "ai",
  },
  {
    n: 6,
    title: "Curta a leitura com a sua criança",
    Icon: BookOpen,
    visual: "covers",
  },
];

function StepVisual({ kind }: { kind: (typeof STEPS)[number]["visual"] }) {
  switch (kind) {
    case "signup":
      return <SignupMock />;
    case "serena":
      return <PhotoGrid photos={SERENA_PHOTOS} label="Fotos da Serena" />;
    case "bingo":
      return <PhotoGrid photos={BINGO_PHOTOS} label="Fotos da Bingo" />;
    case "theme":
      return <ThemeTypingMock />;
    case "ai":
      return <AiWorkingMock />;
    case "covers":
      return <BookCoversMock />;
  }
}

export function LandingRoadmap() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="roadmap-heading"
      className="landing-roadmap relative z-10 px-5 py-16 sm:px-8 sm:py-20 md:px-12 md:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-14">
          <h2
            id="roadmap-heading"
            className="font-story-display text-2xl uppercase leading-[1.15] text-[var(--euzim-ink)] sm:text-3xl md:text-[2.15rem]"
          >
            É assim que você cria a história da sua criança na <InlineBrand />
          </h2>
          <p className="font-story-body mt-4 text-base leading-relaxed text-[var(--euzim-ink-soft)] sm:text-[1.08rem]">
            Em apenas 6 passos rápidos você gera a primeira história que a sua
            criança irá protagonizar
          </p>
        </div>

        <ol className="landing-roadmap-list">
          {STEPS.map((step, idx) => {
            const Icon = step.Icon;
            const reverse = idx % 2 === 1;
            return (
              <li
                key={step.n}
                className={cn(
                  "landing-roadmap-step",
                  reverse && "is-reverse",
                )}
              >
                <div className="landing-roadmap-rail" aria-hidden>
                  <span className="landing-roadmap-dot">{step.n}</span>
                  {idx < STEPS.length - 1 ? (
                    <span className="landing-roadmap-line" />
                  ) : null}
                </div>

                <div className="landing-roadmap-copy">
                  <p className="landing-roadmap-kicker">
                    <Icon className="size-3.5" />
                    Passo {step.n}
                  </p>
                  <h3 className="font-story-display text-xl uppercase leading-snug text-[var(--euzim-ink)] sm:text-[1.35rem]">
                    {step.title.includes("euzim") ? (
                      <>
                        Faça o seu cadastro na <InlineBrand />
                      </>
                    ) : step.title.includes("Euzim") ? (
                      <>
                        Aguarde a <InlineBrand /> gerar a história
                      </>
                    ) : (
                      step.title
                    )}
                  </h3>
                </div>

                <div className="landing-roadmap-visual">
                  <StepVisual kind={step.visual} />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
