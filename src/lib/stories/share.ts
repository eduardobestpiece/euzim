/** Helpers de compartilhamento (client-safe). */

export function storySharePath(shareToken: string): string {
  return `/story/${shareToken}`;
}

export function storyShareUrl(shareToken: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://127.0.0.1:5050";
  return `${base.replace(/\/$/, "")}${storySharePath(shareToken)}`;
}

export async function shareStoryLink(input: {
  title: string;
  shareToken: string;
}): Promise<"shared" | "copied" | "failed"> {
  const url = storyShareUrl(input.shareToken);
  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    (typeof navigator.canShare !== "function" ||
      navigator.canShare({ url, title: input.title }));

  // Mobile / Web Share API (WhatsApp etc.)
  if (canNativeShare && isLikelyMobile()) {
    try {
      await navigator.share({
        title: input.title,
        text: `Leia “${input.title}” no Euzim`,
        url,
      });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "failed";
      }
      // fallback copy
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

function isLikelyMobile(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}
