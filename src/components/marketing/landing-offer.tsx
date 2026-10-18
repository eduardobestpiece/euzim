import Link from "next/link";
import { Check, Rocket, Sparkles } from "lucide-react";
import { InlineBrand } from "@/components/brand/inline-brand";
import { Button } from "@/components/ui/button";
import { formatBrl } from "@/lib/billing/character-packs";
import {
  FAMILY_SUBSCRIPTION,
  STARTER_SUBSCRIPTION,
} from "@/lib/billing/plans";
import { signupPathForPlan } from "@/lib/billing/selected-plan";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    plan: STARTER_SUBSCRIPTION,
    kicker: "Começar leve",
    Icon: Sparkles,
    featured: false,
    highlights: [
      `${STARTER_SUBSCRIPTION.includedCharacters} personagens (avatares)`,
      `${STARTER_SUBSCRIPTION.storiesPerMonth} histórias por mês`,
      "Geração com IA inclusa",
      "Acesso imediato após o pagamento",
    ],
  },
  {
    plan: FAMILY_SUBSCRIPTION,
    kicker: "Mais histórias",
    Icon: Rocket,
    featured: true,
    highlights: [
      `${FAMILY_SUBSCRIPTION.includedCharacters} avatares`,
      `${FAMILY_SUBSCRIPTION.storiesPerMonth} histórias por mês`,
      "Geração com IA inclusa",
      "Ideal para criar toda semana",
    ],
  },
] as const;

export function LandingOffer() {
  return (
    <section
      id="oferta"
      aria-labelledby="offer-heading"
      className="landing-offer relative z-10 px-5 py-16 sm:px-8 sm:py-20 md:px-12 md:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-12">
          <p className="landing-offer-eyebrow font-story-body text-[0.78rem] font-bold tracking-[0.14em] text-[var(--euzim-violet-deep)] uppercase">
            Planos mensais
          </p>
          <h2
            id="offer-heading"
            className="font-story-display mt-3 text-2xl uppercase leading-[1.15] text-[var(--euzim-ink)] sm:text-3xl md:text-[2.15rem]"
          >
            Escolha o ritmo da magia na <InlineBrand />
          </h2>
          <p className="font-story-body mt-4 text-base leading-relaxed text-[var(--euzim-ink-soft)] sm:text-[1.08rem]">
            Dois caminhos claros. Você assina, a plataforma gera os avatares e as
            histórias — e a criança vira protagonista.
          </p>
        </div>

        <div className="landing-offer-grid">
          {PLANS.map(({ plan, kicker, Icon, featured, highlights }) => (
            <article
              key={plan.planId}
              className={cn(
                "landing-offer-card",
                featured && "is-featured",
              )}
            >
              {featured ? (
                <span className="landing-offer-badge">Mais histórias</span>
              ) : null}
              <p className="landing-offer-kicker">
                <Icon className="size-3.5" aria-hidden />
                {kicker}
              </p>
              <h3 className="font-story-display text-[1.55rem] uppercase leading-tight text-[var(--euzim-ink)] sm:text-[1.7rem]">
                {plan.name}
              </h3>
              <p className="landing-offer-price font-story-body">
                <span>{formatBrl(plan.priceBrl)}</span>
                <small>/mês</small>
              </p>
              <p className="font-story-body text-sm leading-relaxed text-[var(--euzim-ink-soft)]">
                {plan.description}
              </p>
              <ul className="landing-offer-list">
                {highlights.map((item) => (
                  <li key={item}>
                    <Check className="size-4 shrink-0" strokeWidth={3} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                size="lg"
                className={cn(
                  "landing-cta-btn mt-auto h-auto min-h-12 w-full gap-2 rounded-2xl border-0 px-5 py-3.5 font-story-body text-[0.95rem] font-semibold",
                  !featured && "landing-offer-cta-secondary",
                )}
              >
                <Link href={signupPathForPlan(plan.planId as "starter" | "family")}>
                  <span className="landing-cta-star" aria-hidden />
                  Quero {plan.name}
                </Link>
              </Button>
            </article>
          ))}
        </div>

        <p className="font-story-body mt-8 text-center text-[0.82rem] text-[var(--euzim-ink-soft)]">
          Compra segura via Stripe · cancele quando quiser · o plano fica atrelado
          à sua conta assim que o pagamento confirma
        </p>
      </div>
    </section>
  );
}
