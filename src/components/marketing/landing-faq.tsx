"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Como as histórias são criadas com a minha criança?",
    a: "A plataforma, através de fotos da sua criança, analisa e cria um perfil gerando um avatar que pode ser usado em várias histórias mantendo a consistência dos traços.",
  },
  {
    q: "As histórias podem ser criadas com mais pessoas?",
    a: "Sim, a plataforma pode envolver pais, mães, irmãos, familiares, amigos e até brinquedos e pets.",
  },
  {
    q: "Eu preciso criar as histórias?",
    a: "Não, você apenas dá o tema e a plataforma faz todo o trabalho: gera as histórias, separa em atos e cria imagens com a sua criança protagonizando.",
  },
  {
    q: "As histórias são criadas com Inteligência Artificial?",
    a: "Sim, uma inteligência artificial treinada com conteúdos literários ricos em conhecimento funciona como base para a construção das histórias.",
  },
  {
    q: "Como funcionam os métodos de pagamento?",
    a: "O pagamento dos planos é via Stripe, podendo ser no cartão de crédito, Apple Pay e, em alguns casos, Pix.",
  },
  {
    q: "O pagamento é mensal?",
    a: "Sim, os planos são mensais. No primeiro mês você recebe 2 avatares e o número de histórias contratado; do segundo mês em diante você recebe o direito de gerar mais histórias de acordo com o seu plano.",
  },
  {
    q: "Posso cancelar quando eu quiser?",
    a: "Sim, você pode cancelar facilmente o plano pelo Perfil quando quiser, podendo gerar as histórias já pagas e evitando cobranças futuras.",
  },
  {
    q: "A plataforma gera histórias sobre temas polêmicos?",
    a: "A plataforma tem travas de segurança que não permitem envolver nas histórias temas woke, identidade de gênero, temas raciais, temas políticos ou qualquer outro tema que seja papel dos pais abordar.",
  },
  {
    q: "Como funcionam os planos?",
    a: "No plano de R$ 24,90, você recebe 2 avatares e a possibilidade de gerar 4 histórias por mês. No plano de R$ 49,90, você recebe 2 avatares e a possibilidade de gerar 10 histórias por mês (8 histórias e mais 2 histórias bônus).",
  },
] as const;

export function LandingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="landing-faq relative z-10 px-5 py-16 sm:px-8 sm:py-20 md:px-12 md:py-24"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
          <h2
            id="faq-heading"
            className="font-story-display text-2xl uppercase text-[var(--euzim-ink)] sm:text-3xl md:text-[2.1rem]"
          >
            Perguntas frequentes
          </h2>
          <p className="font-story-body mt-3 text-base leading-relaxed text-[var(--euzim-ink-soft)]">
            Tudo o que você precisa saber antes de começar
          </p>
        </div>

        <ul className="landing-faq-list">
          {FAQS.map((item, index) => {
            const isOpen = open === index;
            return (
              <li key={item.q} className="landing-faq-item">
                <button
                  type="button"
                  className="landing-faq-trigger"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : index)}
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={cn(
                      "landing-faq-chevron size-4 shrink-0",
                      isOpen && "is-open",
                    )}
                    aria-hidden
                  />
                </button>
                {isOpen ? (
                  <p className="landing-faq-answer font-story-body">{item.a}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
