"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Gift, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyReferralShareUrlAction } from "@/lib/referral/actions";

/** Compartilhar app (indicação). Mostra link completo e copia. */
export function ShareAppButton({
  initialCode = null,
  initialUrl = null,
  compact = false,
}: {
  initialCode?: string | null;
  initialUrl?: string | null;
  compact?: boolean;
} = {}) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [code, setCode] = useState<string | null>(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (initialCode && initialUrl) {
      setCode(initialCode);
      setUrl(initialUrl);
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      const result = await getMyReferralShareUrlAction();
      if (cancelled) return;
      if (result.error || !result.url || !result.code) {
        setError(result.error ?? "Falha ao gerar link.");
        return;
      }
      const absolute = result.url.startsWith("http")
        ? result.url
        : typeof window !== "undefined"
          ? `${window.location.origin}${result.path ?? result.url}`
          : result.url;
      setCode(result.code);
      setUrl(absolute);
      setError(null);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resolveAbsolute(raw: string): string {
    if (raw.startsWith("http")) return raw;
    return `${window.location.origin}${raw.startsWith("/") ? raw : `/${raw}`}`;
  }

  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  }

  function copyLink() {
    if (!url) return;
    setCopied(false);
    setError(null);
    const absolute = resolveAbsolute(url);
    setUrl(absolute);
    startTransition(async () => {
      const ok = await copyText(absolute);
      if (ok) setCopied(true);
      else setError("Não foi possível copiar. Selecione o link manualmente.");
    });
  }

  function shareOrCopy() {
    setError(null);
    startTransition(async () => {
      let resultUrl = url;
      let resultCode = code;
      if (!resultUrl || !resultCode) {
        const result = await getMyReferralShareUrlAction();
        if (result.error || !result.url || !result.code) {
          setError(result.error ?? "Falha ao gerar link.");
          return;
        }
        resultCode = result.code;
        resultUrl = resolveAbsolute(result.url.startsWith("http") ? result.url : (result.path ?? result.url));
        setCode(resultCode);
        setUrl(resultUrl);
      } else {
        resultUrl = resolveAbsolute(resultUrl);
        setUrl(resultUrl);
      }

      try {
        if (navigator.share) {
          await navigator.share({
            title: "Euzim",
            text: "Conheça o Euzim: histórias personalizadas para crianças.",
            url: resultUrl,
          });
          return;
        }
      } catch {
        /* fall through to copy */
      }
      if (await copyText(resultUrl)) setCopied(true);
      else setError("Não foi possível copiar. Selecione o link manualmente.");
    });
  }

  if (compact) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        disabled={pending}
        onClick={shareOrCopy}
      >
        <Gift className="size-3.5" />
        {pending ? "Gerando…" : "Compartilhar app"}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      {code ? (
        <p className="text-sm text-muted-foreground">
          Código:{" "}
          <span className="font-mono font-semibold text-foreground">{code}</span>
        </p>
      ) : pending ? (
        <p className="text-sm text-muted-foreground">Gerando seu código…</p>
      ) : null}

      {url ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="flex min-w-0 flex-1 items-start gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
            <Link2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="break-all font-mono text-xs leading-relaxed text-foreground">
              {url}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="gap-1.5 sm:w-auto"
            disabled={pending || !url}
            onClick={copyLink}
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copiado" : "Copiar link"}
          </Button>
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="gap-1.5"
        disabled={pending}
        onClick={shareOrCopy}
      >
        <Gift className="size-3.5" />
        {pending ? "Gerando…" : "Compartilhar app"}
      </Button>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
