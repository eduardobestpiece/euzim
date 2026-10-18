import Link from "next/link";
import { BookOpen, Check, ShieldCheck, Sparkles, Users } from "lucide-react";
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
    tone: "starter" as const,
    kicker: "Para começar",
    featured: false,
    metric: STARTER_SUBSCRIPTION.storiesPerMonth,
    metricLabel: "histórias / mês",
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
        text: "Acesso imediato após o pagamento",
      },
    ],
  },
  {
    plan: FAMILY_SUBSCRIPTION,
    tone: "family" as const,
    kicker: "Mais amado",
    featured: true,
    metric: FAMILY_SUBSCRIPTION.storiesPerMonth,
    metricLabel: "histórias / mês",
    highlights: [
      {
        icon: Users,
        text: `${FAMILY_SUBSCRIPTION.includedCharacters} avatares para a família`,
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
        text: "Ritmo ideal para criar toda semana",
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
          <p className="landing-offer-eyebrow">Planos mensais</p>
          <h2 id="offer-heading" className="landing-offer-title">
            Escolha o ritmo da magia na <InlineBrand />
          </h2>
          <p className="landing-offer-lede">
            Dois caminhos claros. Assine, a plataforma gera os avatares e as
            histórias — e a criança vira protagonista.
          </p>
        </div>

        <div className="landing-offer-grid">
          {PLANS.map(
            ({
              plan,
              tone,
              kicker,
              featured,
              metric,
              metricLabel,
              highlights,
            }) => (
              <article
                key={plan.planId}
                className={cn(
                  "landing-offer-card",
                  `is-${tone}`,
                  featured && "is-featured",
                )}
              >
                {featured ? (
                  <span className="landing-offer-badge">Recomendado</span>
                ) : null}

                <div className="landing-offer-card-top">
                  <p className="landing-offer-kicker">{kicker}</p>
                  <h3 className="landing-offer-name">{plan.name}</h3>
                  <p className="landing-offer-desc">{plan.description}</p>
                </div>

                <div className="landing-offer-metric" aria-hidden>
                  <strong>{metric}</strong>
                  <span>{metricLabel}</span>
                </div>

                <div className="landing-offer-price-row">
                  <p className="landing-offer-price">
                    <span className="landing-offer-currency">R$</span>
                    <span className="landing-offer-amount">
                      {plan.priceBrl.toFixed(2).replace(".", ",")}
                    </span>
                    <span className="landing-offer-period">/mês</span>
                  </p>
                  <p className="landing-offer-price-note">
                    {formatBrl(plan.priceBrl)} cobrados mensalmente
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
                  className={cn(
                    "landing-offer-cta mt-auto h-auto min-h-12 w-full gap-2 rounded-2xl border-0 px-5 py-3.5 font-story-body text-[0.95rem] font-semibold",
                    featured
                      ? "landing-cta-btn"
                      : "landing-offer-cta-secondary",
                  )}
                >
                  <Link
                    href={signupPathForPlan(
                      plan.planId as "starter" | "family",
                    )}
                  >
                    {featured ? (
                      <span className="landing-cta-star" aria-hidden />
                    ) : (
                      <Check className="size-4" aria-hidden />
                    )}
                    Quero {plan.name}
                  </Link>
                </Button>
              </article>
            ),
          )}
        </div>

        <p className="landing-offer-trust">
          Compra segura via Stripe · cancele quando quiser · o plano fica
          atrelado à conta assim que o pagamento confirma
        </p>
      </div>
    </section>
  );
}
