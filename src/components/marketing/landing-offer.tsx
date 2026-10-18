import Link from "next/link";
import { BookOpen, Check, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FAMILY_SUBSCRIPTION,
  STARTER_SUBSCRIPTION,
} from "@/lib/billing/plans";
import { signupPathForPlan } from "@/lib/billing/selected-plan";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    plan: STARTER_SUBSCRIPTION,
    badge: "Para Aventureiros",
    favorite: false,
    cta: "Quero começar a Criar",
    highlights: [
      {
        icon: Users,
        text: `${STARTER_SUBSCRIPTION.includedCharacters} personagens (avatares)`,
      },
      {
        icon: BookOpen,
        text: `${STARTER_SUBSCRIPTION.storiesPerMonth} histórias novas todo mês`,
      },
      {
        icon: Sparkles,
        text: "Geração com IA inclusa",
      },
      {
        icon: ShieldCheck,
        text: "Uma história nova toda semana",
      },
    ],
  },
  {
    plan: FAMILY_SUBSCRIPTION,
    badge: "Para Realizadores",
    favorite: true,
    cta: "Quero Criar Novos Hábitos",
    highlights: [
      {
        icon: Users,
        text: `${FAMILY_SUBSCRIPTION.includedCharacters} avatares (avatares)`,
      },
      {
        icon: BookOpen,
        text: `${FAMILY_SUBSCRIPTION.storiesPerMonth} histórias por mês`,
      },
      {
        icon: Sparkles,
        text: "Geração com IA inclusa",
      },
      {
        icon: ShieldCheck,
        text: "Histórias novas a cada 3 dias",
      },
    ],
  },
] as const;

export function LandingOffer() {
  return (
    <section
      id="oferta"
      aria-labelledby="offer-heading"
      className="landing-offer relative z-10 overflow-hidden px-5 py-16 sm:px-8 sm:py-20 md:px-12 md:py-24"
    >
      <div aria-hidden className="landing-offer-glow" />

      <div className="relative mx-auto max-w-5xl">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
          <h2 id="offer-heading" className="landing-offer-title">
            Sua criança merece ser protagonista
          </h2>
          <p className="landing-offer-lede">
            Comece agora a criar as histórias que irão mudar os hábitos da sua
            criança em poucos passos
          </p>
        </div>

        <div className="landing-offer-grid">
          {PLANS.map(({ plan, badge, favorite, cta, highlights }) => (
            <article
              key={plan.planId}
              className={cn(
                "landing-offer-card",
                `is-${plan.planId}`,
                favorite && "is-favorite",
              )}
            >
              {favorite ? (
                <span className="landing-offer-favorite">Favorito</span>
              ) : null}

              <p className="landing-offer-kicker">{badge}</p>

              <div className="landing-offer-price-row">
                <p className="landing-offer-price">
                  <span className="landing-offer-currency">R$</span>
                  <span className="landing-offer-amount">
                    {plan.priceBrl.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="landing-offer-period">/mês</span>
                </p>
              </div>

              <ul className="landing-offer-list">
                {highlights.map(({ icon: Icon, text }) => (
                  <li key={text}>
                    <span className="landing-offer-check" aria-hidden>
                      <Icon className="size-3.5" strokeWidth={2.4} />
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                size="lg"
                className="landing-offer-cta landing-cta-btn mt-auto h-auto min-h-12 w-full gap-2 rounded-2xl border-0 px-5 py-3.5 font-story-body text-[0.95rem] font-semibold"
              >
                <Link
                  href={signupPathForPlan(
                    plan.planId as "starter" | "family",
                  )}
                >
                  <Check className="size-4" aria-hidden />
                  {cta}
                </Link>
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
