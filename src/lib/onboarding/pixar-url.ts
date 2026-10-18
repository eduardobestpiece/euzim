/** True se a URL é avatar Pixar gerado (nunca foto crua do upload). */
export function isPixarGeneratedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Storage path das gerações: .../generated/child-hero-....jpg
  if (url.includes("/generated/")) return true;
  // Artefatos locais de prova / legado
  if (url.includes("/pixar-")) return true;
  // Fallback quando o upload ao Storage falha (só JPEG base64 da IA)
  if (url.startsWith("data:image/jpeg;base64,") && url.length > 500) {
    return true;
  }
  return false;
}
