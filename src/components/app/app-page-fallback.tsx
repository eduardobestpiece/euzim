/** Fallback compartilhado para páginas /app/* sob cacheComponents + Suspense. */
export function AppPageFallback({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
      {label}
    </div>
  );
}
