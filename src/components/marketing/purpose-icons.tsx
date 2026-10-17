import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function IconShell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-12 items-center justify-center rounded-2xl",
        className
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-7"
      >
        {children}
      </svg>
    </span>
  );
}

/** Escudo + estrela — vencer medos */
export function IconOvercomeFears({ className }: { className?: string }) {
  return (
    <IconShell className={cn("bg-[var(--euzim-mint-soft)]", className)}>
      <path
        d="M24 6L38 12V22.5C38 32 31.5 39.2 24 42C16.5 39.2 10 32 10 22.5V12L24 6Z"
        stroke="var(--euzim-violet)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M24 18.5L25.6 22.2L29.7 22.6L26.6 25.3L27.5 29.3L24 27.2L20.5 29.3L21.4 25.3L18.3 22.6L22.4 22.2L24 18.5Z"
        fill="var(--euzim-star)"
        stroke="var(--euzim-star)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </IconShell>
  );
}

/** Livro aberto — bons hábitos */
export function IconGoodHabits({ className }: { className?: string }) {
  return (
    <IconShell className={cn("bg-[var(--euzim-star-soft)]", className)}>
      <path
        d="M10 14C14 12.5 18.5 12 24 14.5C29.5 12 34 12.5 38 14V36C34 34.2 29.5 33.8 24 36C18.5 33.8 14 34.2 10 36V14Z"
        stroke="var(--euzim-violet)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M24 15V35.5"
        stroke="var(--euzim-violet)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 20H19M14 25H18.5M29 20H34M29.5 25H34"
        stroke="var(--euzim-violet-deep)"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.7"
      />
    </IconShell>
  );
}

/** Coração + caminho — valores */
export function IconBuildValues({ className }: { className?: string }) {
  return (
    <IconShell className={cn("bg-[var(--euzim-sky-soft)]", className)}>
      <path
        d="M24 38C24 38 10 29.5 10 19.5C10 14.8 13.6 12 17.4 12C20.2 12 22.4 13.5 24 15.8C25.6 13.5 27.8 12 30.6 12C34.4 12 38 14.8 38 19.5C38 29.5 24 38 24 38Z"
        stroke="var(--euzim-violet)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M18 22.5C19.5 24.8 21.5 26.5 24 27.5C26.5 26.5 28.5 24.8 30 22.5"
        stroke="var(--euzim-star)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </IconShell>
  );
}
