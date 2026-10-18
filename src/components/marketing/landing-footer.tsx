import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { PLATFORM_BUILD } from "@/lib/platform-build";

/** Ano fixo — evita `new Date()` no prerender (Blocking Route / unstable value). */
const COPYRIGHT_YEAR = 2026;

export function LandingFooter() {
  return (
    <footer className="landing-footer relative z-10 px-5 pb-10 pt-8 sm:px-8 md:px-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 border-t border-[rgba(109,40,217,0.12)] pt-8 sm:flex-row sm:items-center sm:justify-between">
        <BrandLogo size="compact" variant="black" />

        <nav
          aria-label="Rodapé"
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-story-body text-[0.88rem] text-[var(--euzim-ink-soft)]"
        >
          <Link
            href="/login"
            className="transition-colors hover:text-[var(--euzim-ink)]"
          >
            Login
          </Link>
          <a
            href="#oferta"
            className="transition-colors hover:text-[var(--euzim-ink)]"
          >
            Planos
          </a>
          <a
            href="#faq"
            className="transition-colors hover:text-[var(--euzim-ink)]"
          >
            FAQ
          </a>
        </nav>

        <div className="flex flex-col items-center gap-0.5 text-center font-story-body text-[0.75rem] text-[var(--euzim-ink-soft)] sm:items-end sm:text-right">
          <span>© {COPYRIGHT_YEAR} Euzim</span>
          <span className="opacity-70">{PLATFORM_BUILD}</span>
        </div>
      </div>
    </footer>
  );
}
