import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  IconBuildValues,
  IconGoodHabits,
  IconOvercomeFears,
} from "@/components/marketing/purpose-icons";
import { Button } from "@/components/ui/button";
import { formatBrl } from "@/lib/billing/character-packs";
import { STARTER_SUBSCRIPTION } from "@/lib/billing/plans";

const PURPOSES = [
  {
    title: "Vencer medos",
    body: "Escuro, agulha, primeira noite longe de casa… Nas histórias do Euzim, a criança se vê superando o que a assusta — com coragem e carinho.",
    Icon: IconOvercomeFears,
  },
  {
    title: "Criar bons hábitos",
    body: "Troque a ansiedade dos jogos e dos vídeos curtos pela leitura que treina foco, calma e imaginação — um hábito que cresce com ela.",
    Icon: IconGoodHabits,
  },
  {
    title: "Construir valores",
    body: "Aventuras leves que ensinam caminhos da família — respeito, generosidade, coragem — sem sermão, só história boa de viver juntos.",
    Icon: IconBuildValues,
  },
] as const;

export function LandingHome({ mockMode = false }: { mockMode?: boolean }) {
  const priceLabel = formatBrl(STARTER_SUBSCRIPTION.priceBrl);

  return (
    <div className="landing-root relative flex min-h-full flex-1 flex-col">
      <header className="landing-header relative z-20 flex items-center justify-between px-5 py-4 sm:px-8 md:px-12">
        <BrandLogo size="header" priority />
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="font-story-body text-[0.9rem] text-[var(--euzim-ink)] hover:bg-[var(--euzim-violet-soft)]"
        >
          <Link href="/login">Login</Link>
        </Button>
      </header>

      <section
        aria-label="Apresentação Euzim"
        className="landing-hero relative z-10 flex min-h-[calc(100svh-4.5rem)] flex-col overflow-hidden md:min-h-[calc(100svh-5rem)]"
      >
        <div
          aria-hidden
          className="landing-hero-atmosphere pointer-events-none absolute inset-0"
        />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-6 px-5 pb-10 pt-2 sm:px-8 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:gap-4 md:px-12 md:pb-16 lg:gap-8">
          <div className="landing-hero-copy flex flex-col items-start gap-5 md:gap-6">
            <BrandLogo
              size="auth"
              href={null}
              priority
              className="landing-hero-brand h-[3.25rem] w-auto sm:h-16 md:h-[4.5rem]"
            />

            <h1 className="landing-hero-title font-story-display max-w-[18ch] text-[1.85rem] leading-[1.12] tracking-tight text-[var(--euzim-ink)] sm:text-4xl md:text-[2.75rem] lg:text-[3.15rem]">
              Crie histórias onde a sua criança é a protagonista
            </h1>

            <div className="font-story-body max-w-md space-y-3 text-[0.98rem] leading-relaxed text-[var(--euzim-ink-soft)] sm:text-base md:max-w-lg md:text-[1.05rem]">
              <p>
                Se o celular prende a atenção com jogos e vídeos sem fim, o
                Euzim constrói o{" "}
                <span className="font-semibold text-[var(--euzim-ink)]">
                  hábito da leitura
                </span>{" "}
                com histórias em que{" "}
                <span className="font-semibold text-[var(--euzim-ink)]">
                  ela é a protagonista
                </span>
                .
              </p>
              <p className="landing-hero-reassure">
                E não se preocupe: você não precisa criar nenhuma história —{" "}
                <mark className="landing-mark">nós fazemos tudo por você</mark>.
              </p>
            </div>

            <div className="landing-hero-cta pt-1">
              <Button
                asChild
                size="lg"
                className="landing-cta-btn h-auto min-h-12 gap-2 rounded-2xl border-0 px-5 py-3.5 font-story-body text-[0.95rem] font-semibold sm:text-base"
              >
                <Link href="/signup">
                  <span className="landing-cta-star" aria-hidden />
                  Começar a Criar Histórias · {priceLabel}
                </Link>
              </Button>
            </div>

            {mockMode ? (
              <p className="font-story-body text-sm text-amber-800/90">
                Modo demo — configure `.env.local` para login real.
              </p>
            ) : null}
          </div>

          <div className="landing-hero-visual relative mx-auto w-full max-w-lg md:mx-0 md:max-w-none md:justify-self-end">
            <div
              aria-hidden
              className="landing-hero-blob pointer-events-none absolute -inset-[8%] -z-10"
            />
            <Image
              src="/brand/euzim-hero-serena-boy.jpg"
              alt="Serena e um menino vivendo aventuras juntos — protagonistas de uma história Euzim"
              width={1280}
              height={720}
              priority
              className="landing-hero-image h-auto w-full object-contain object-bottom drop-shadow-[0_18px_40px_rgba(72,40,120,0.14)]"
              sizes="(max-width: 768px) 92vw, 48vw"
            />
          </div>
        </div>

        <div
          aria-hidden
          className="landing-hero-wave pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-10 sm:h-14"
        />
      </section>

      <section
        id="proposito"
        aria-labelledby="proposito-heading"
        className="landing-purpose relative z-10 px-5 py-16 sm:px-8 sm:py-20 md:px-12 md:py-24"
      >
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="proposito-heading"
              className="font-story-display text-2xl tracking-tight text-[var(--euzim-ink)] sm:text-3xl md:text-[2.1rem]"
            >
              Para que serve o Euzim
            </h2>
            <p className="font-story-body mt-3 text-base leading-relaxed text-[var(--euzim-ink-soft)] sm:text-[1.05rem]">
              Três caminhos simples: menos medo, melhores hábitos, valores que
              ficam.
            </p>
          </div>

          <ul className="mt-12 grid list-none gap-10 p-0 sm:mt-14 md:grid-cols-3 md:gap-8 lg:gap-12">
            {PURPOSES.map(({ title, body, Icon }) => (
              <li key={title} className="landing-purpose-item flex flex-col gap-3">
                <Icon />
                <h3 className="font-story-display text-xl text-[var(--euzim-ink)]">
                  {title}
                </h3>
                <p className="font-story-body text-[0.98rem] leading-relaxed text-[var(--euzim-ink-soft)]">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
