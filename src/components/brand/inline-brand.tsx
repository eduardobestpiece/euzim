import { cn } from "@/lib/utils";

/**
 * Logo preta inline (substitui a palavra "euzim").
 * `<img>` replaced inline — baseline natural; sem margem extra
 * (o espaço vem dos espaços do parágrafo).
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
      width={520}
      height={257}
      decoding="async"
      draggable={false}
      className={cn("inline-brand", className)}
    />
  );
}
