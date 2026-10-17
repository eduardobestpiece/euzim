import { cn } from "@/lib/utils";

/**
 * Logo preta inline (substitui a palavra "euzim").
 * `inline-block` + altura em `em` — `display:inline` ignorava height e
 * estourava o wordmark na largura intrínseca (520px).
 */
export function InlineBrand({
  className,
  title = "euzim",
}: {
  className?: string;
  title?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/euzim-logo-black.png"
      alt={title}
      width={96}
      height={36}
      decoding="async"
      draggable={false}
      className={cn("inline-brand", className)}
    />
  );
}
