"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Como as histórias são criadas com a minha criança?",
    a: "A partir das fotos da sua criança, a plataforma analisa o rosto, cria um perfil e gera um avatar que pode ser usado em várias histórias, mantendo a consistência dos traços.",
  },
  {
    q: "As histórias podem ser criadas com mais pessoas?",
    a: "Sim. A plataforma pode envolver pais, mães, irmãos, familiares, amigos e até brinquedos e pets.",
  },
  {
    q: "Eu preciso criar as histórias?",
    a: "Não. Você só escolhe o tema e a plataforma faz o resto: escreve a história, separa em atos e cria as imagens com a sua criança como protagonista.",
  },
  {
    q: "As histórias são criadas com Inteligência Artificial?",
    a: "Sim. Uma inteligência artificial treinada com conteúdos literários ricos em conhecimento serve de base para a construção das histórias.",
  },
  {
    q: "Como funcionam os métodos de pagamento?",
    a: "O pagamento dos planos é feito via Stripe e pode ser no cartão de crédito, Apple Pay e, em alguns casos, Pix.",
  },
  {
    q: "O pagamento é mensal?",
    a: "Sim, os planos são mensais. No primeiro mês você recebe 2 avatares e o número de histórias contratado. Do segundo mês em diante, você passa a ter direito de gerar mais histórias de acordo com o seu plano.",
  },
  {
    q: "Posso cancelar quando eu quiser?",
    a: "Sim. Você pode cancelar o plano pelo Perfil a qualquer momento, continuar gerando as histórias já pagas e evitar cobranças futuras.",
  },
  {
    q: "A plataforma gera histórias sobre temas polêmicos?",
    a: "A plataforma tem travas de segurança que impedem histórias com temas woke, identidade de gênero, temas raciais, temas políticos ou qualquer outro assunto que seja papel dos pais abordar.",
  },
  {
    q: "Como funcionam os planos?",
    a: "No plano de R$ 24,90, você recebe 2 avatares e pode gerar 4 histórias por mês. No plano de R$ 49,90, você recebe 2 avatares e pode gerar 10 histórias por mês (8 histórias e mais 2 histórias bônus).",
  },
] as const;

export function LandingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="landing-faq relative z-10 overflow-hidden px-5 py-16 sm:px-8 sm:py-20 md:px-12 md:py-24"
    >
      <div aria-hidden className="landing-faq-glow" />

      <div className="relative mx-auto max-w-3xl">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
          <p className="landing-faq-eyebrow">
            <Sparkles className="size-3.5" aria-hidden />
            Tire suas dúvidas
          </p>
          <h2
            id="faq-heading"
            className="font-story-display mt-3 text-2xl uppercase text-[var(--euzim-ink)] sm:text-3xl md:text-[2.1rem]"
          >
            Perguntas frequentes
          </h2>
          <p className="font-story-body mt-3 text-base leading-relaxed text-[var(--euzim-ink-soft)]">
            Tudo o que você precisa saber antes de começar a aventura
          </p>
        </div>

        <ul className="landing-faq-list">
          {FAQS.map((item, index) => {
            const isOpen = open === index;
            return (
              <li
                key={item.q}
                className={cn("landing-faq-item", isOpen && "is-open")}
              >
                <button
                  type="button"
                  className="landing-faq-trigger"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : index)}
                >
                  <span className="landing-faq-index" aria-hidden>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="landing-faq-q">{item.q}</span>
                  <span className="landing-faq-icon" aria-hidden>
                    <ChevronDown
                      className={cn(
                        "landing-faq-chevron size-4",
                        isOpen && "is-open",
                      )}
                    />
                  </span>
                </button>
                <div
                  className={cn(
                    "landing-faq-panel",
                    isOpen ? "is-open" : "is-closed",
                  )}
                >
                  <p className="landing-faq-answer font-story-body">{item.a}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
