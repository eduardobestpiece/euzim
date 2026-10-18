import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingFinalCta() {
  return (
    <section
      id="comecar"
      aria-labelledby="final-cta-heading"
      className="landing-final-cta relative z-10 px-5 py-16 sm:px-8 sm:py-20 md:px-12 md:py-24"
    >
      <div className="landing-final-cta-card mx-auto max-w-3xl text-center">
        <h2
          id="final-cta-heading"
          className="font-story-display text-2xl uppercase text-[var(--euzim-ink)] sm:text-3xl md:text-[2.2rem]"
        >
          Experimente por 30 dias
        </h2>
        <p className="font-story-body mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--euzim-ink-soft)] sm:text-[1.05rem]">
          Agora que você sabe que pode cancelar a qualquer momento, faça a sua
          assinatura pelos primeiros 30 dias e veja a alegria que sua criança
          terá ao mostrar as 4 primeiras histórias que mostrarão como vencer
          medos, realizar conquistas e ter hábitos de crescimento
        </p>
        <div className="mt-8 flex justify-center">
          <Button
            asChild
            size="lg"
            className="landing-cta-btn h-auto min-h-12 gap-2 rounded-2xl border-0 px-6 py-3.5 font-story-body text-[0.95rem] font-semibold sm:text-base"
          >
            <Link href="/signup">
              <span className="landing-cta-star" aria-hidden />
              Quero começar a criar
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
