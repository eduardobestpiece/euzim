import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo preta inline no fluxo de texto (branding no lugar da palavra "euzim").
 * Asset preto sólido (sem padding extra); altura em `em` acompanha a fonte.
 */
export function InlineBrand({
  className,
  title = "euzim",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn(
        "inline-brand relative mx-[0.14em] inline-flex h-[1.5em] w-[4em] shrink-0 translate-y-[-0.1em] items-center align-baseline",
        className,
      )}
      role="img"
      aria-label={title}
    >
      <Image
        src="/brand/euzim-logo-black.png"
        alt=""
        width={480}
        height={236}
        unoptimized
        className="h-full w-full object-contain object-left"
      />
    </span>
  );
}
