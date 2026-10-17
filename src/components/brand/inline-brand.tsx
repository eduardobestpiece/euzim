import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo preta inline no fluxo de texto (branding no lugar da palavra "euzim").
 * Altura ~1em para acompanhar o tamanho da fonte do parágrafo/título.
 */
export function InlineBrand({
  className,
  title = "euzim",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <Image
      src="/brand/euzim-logo-black.png"
      alt={title}
      width={96}
      height={36}
      className={cn(
        "mx-0.5 inline-block h-[1.05em] w-auto translate-y-[-0.08em] object-contain object-left align-baseline",
        className,
      )}
    />
  );
}
