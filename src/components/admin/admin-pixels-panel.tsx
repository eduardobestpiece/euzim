"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  deleteTrackingPixelAction,
  deleteTrackingTagAction,
  deleteTrackingWebhookAction,
  upsertTrackingPixelAction,
  upsertTrackingTagAction,
  upsertTrackingWebhookAction,
  type PixelsAdminBundle,
} from "@/lib/admin/pixels-actions";
import { TRACKING_EVENT_KEYS } from "@/lib/tracking/types";

const ADS_LABEL_KEYS = [
  "Lead",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Purchase",
  "CompleteRegistration",
] as const;

type PixelKind = "meta" | "google_ads" | "ga4";

export function AdminPixelsPanel({
  initial,
}: {
  initial: PixelsAdminBundle;
}) {
  const [bundle] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<
    "meta" | "google_ads" | "ga4" | "tags" | "webhooks"
  >("meta");

  // Meta form
  const [metaLabel, setMetaLabel] = useState("");
  const [metaPixelId, setMetaPixelId] = useState("");
  const [metaToken, setMetaToken] = useState("");

  // Ads form
  const [adsLabel, setAdsLabel] = useState("");
  const [adsAwId, setAdsAwId] = useState("");
  const [adsLabels, setAdsLabels] = useState<Record<string, string>>({});

  // GA4 form
  const [ga4Label, setGa4Label] = useState("");
  const [ga4Id, setGa4Id] = useState("");

  // Tag form
  const [tagName, setTagName] = useState("");
  const [tagHtml, setTagHtml] = useState("");

  // Webhook form
  const [whLabel, setWhLabel] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whSecret, setWhSecret] = useState("");
  const [whEvents, setWhEvents] = useState<string[]>([
    "Lead",
    "InitiateCheckout",
    "AddPaymentInfo",
    "Purchase",
    "CompleteRegistration",
  ]);

  function toastOk(msg: string) {
    setError(null);
    setMessage(msg);
  }

  function run(fn: () => Promise<{ error?: string; success?: boolean }>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) {
        setError(result.error);
        return;
      }
      toastOk("Salvo.");
      window.location.reload();
    });
  }

  const pixelsOf = (kind: PixelKind) =>
    bundle.pixels.filter((p) => p.kind === kind);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Pixels e tracking
        </h2>
        <p className="text-sm text-muted-foreground">
          Meta CAPI, Google Ads, GA4, tags no head e webhooks de conversão.
        </p>
      </div>

      {bundle.error ? (
        <p className="rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {bundle.error}. Se as tabelas ainda não existem, aplique{" "}
          <code className="text-xs">docs/tracking-pixels-migration.sql</code> no
          Supabase.
        </p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["meta", "Meta"],
            ["google_ads", "Google Ads"],
            ["ga4", "GA4"],
            ["tags", "Tags"],
            ["webhooks", "Webhooks"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={section === id ? "default" : "outline"}
            onClick={() => setSection(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {section === "meta" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/70 p-4 space-y-3">
            <p className="text-sm font-medium">Novo pixel Meta</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input
                  value={metaLabel}
                  onChange={(e) => setMetaLabel(e.target.value)}
                  placeholder="Principal"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pixel ID</Label>
                <Input
                  value={metaPixelId}
                  onChange={(e) => setMetaPixelId(e.target.value)}
                  placeholder="1234567890"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>CAPI access token</Label>
                <Input
                  value={metaToken}
                  onChange={(e) => setMetaToken(e.target.value)}
                  placeholder="EAAB..."
                  type="password"
                  autoComplete="off"
                />
              </div>
            </div>
            <Button
              type="button"
              disabled={pending || !metaPixelId.trim()}
              onClick={() =>
                run(() =>
                  upsertTrackingPixelAction({
                    kind: "meta",
                    label: metaLabel || "Meta",
                    isActive: true,
                    pixelId: metaPixelId,
                    capiAccessToken: metaToken,
                  }),
                )
              }
            >
              <Plus className="size-3.5" />
              Adicionar Meta
            </Button>
          </div>
          <ul className="space-y-2">
            {pixelsOf("meta").map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2"
              >
                <div>
                  <p className="font-medium">{p.label || "Meta"}</p>
                  <p className="text-xs text-muted-foreground">
                    Pixel {p.pixel_id}
                    {p.capi_access_token ? " · CAPI ok" : " · sem CAPI"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.is_active ? "default" : "outline"}>
                    {p.is_active ? "Ativo" : "Off"}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => deleteTrackingPixelAction(p.id))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
            {!pixelsOf("meta").length ? (
              <p className="text-sm text-muted-foreground">Nenhum pixel Meta.</p>
            ) : null}
          </ul>
        </div>
      ) : null}

      {section === "google_ads" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/70 p-4 space-y-3">
            <p className="text-sm font-medium">Novo Google Ads</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input
                  value={adsLabel}
                  onChange={(e) => setAdsLabel(e.target.value)}
                  placeholder="Ads principal"
                />
              </div>
              <div className="space-y-1.5">
                <Label>AW ID</Label>
                <Input
                  value={adsAwId}
                  onChange={(e) => setAdsAwId(e.target.value)}
                  placeholder="AW-123456789"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ADS_LABEL_KEYS.map((key) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{key}</Label>
                  <Input
                    value={adsLabels[key] || ""}
                    onChange={(e) =>
                      setAdsLabels((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    placeholder="label/xxxxxx"
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              disabled={pending || !adsAwId.trim()}
              onClick={() =>
                run(() =>
                  upsertTrackingPixelAction({
                    kind: "google_ads",
                    label: adsLabel || "Google Ads",
                    isActive: true,
                    awId: adsAwId,
                    conversionLabels: adsLabels,
                  }),
                )
              }
            >
              <Plus className="size-3.5" />
              Adicionar Ads
            </Button>
          </div>
          <ul className="space-y-2">
            {pixelsOf("google_ads").map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2"
              >
                <div>
                  <p className="font-medium">{p.label || "Ads"}</p>
                  <p className="text-xs text-muted-foreground">{p.aw_id}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => deleteTrackingPixelAction(p.id))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {section === "ga4" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/70 p-4 space-y-3">
            <p className="text-sm font-medium">Novo GA4</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input
                  value={ga4Label}
                  onChange={(e) => setGa4Label(e.target.value)}
                  placeholder="GA4 principal"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Measurement ID</Label>
                <Input
                  value={ga4Id}
                  onChange={(e) => setGa4Id(e.target.value)}
                  placeholder="G-XXXXXXXX"
                />
              </div>
            </div>
            <Button
              type="button"
              disabled={pending || !ga4Id.trim()}
              onClick={() =>
                run(() =>
                  upsertTrackingPixelAction({
                    kind: "ga4",
                    label: ga4Label || "GA4",
                    isActive: true,
                    measurementId: ga4Id,
                  }),
                )
              }
            >
              <Plus className="size-3.5" />
              Adicionar GA4
            </Button>
          </div>
          <ul className="space-y-2">
            {pixelsOf("ga4").map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2"
              >
                <div>
                  <p className="font-medium">{p.label || "GA4"}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.measurement_id}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => deleteTrackingPixelAction(p.id))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {section === "tags" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/70 p-4 space-y-3">
            <p className="text-sm font-medium">Nova tag HTML/JS</p>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Hotjar / remarketing"
              />
            </div>
            <div className="space-y-1.5">
              <Label>HTML / script</Label>
              <textarea
                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                value={tagHtml}
                onChange={(e) => setTagHtml(e.target.value)}
                placeholder="<script>...</script>"
              />
            </div>
            <Button
              type="button"
              disabled={pending || !tagHtml.trim()}
              onClick={() =>
                run(() =>
                  upsertTrackingTagAction({
                    name: tagName || "Tag",
                    html: tagHtml,
                    isActive: true,
                  }),
                )
              }
            >
              <Plus className="size-3.5" />
              Adicionar tag
            </Button>
          </div>
          <ul className="space-y-2">
            {bundle.tags.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2"
              >
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.html.slice(0, 80)}
                    {t.html.length > 80 ? "…" : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => deleteTrackingTagAction(t.id))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {section === "webhooks" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/70 p-4 space-y-3">
            <p className="text-sm font-medium">Novo webhook</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input
                  value={whLabel}
                  onChange={(e) => setWhLabel(e.target.value)}
                  placeholder="CRM / Make"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Secret (opcional)</Label>
                <Input
                  value={whSecret}
                  onChange={(e) => setWhSecret(e.target.value)}
                  type="password"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>URL</Label>
                <Input
                  value={whUrl}
                  onChange={(e) => setWhUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {TRACKING_EVENT_KEYS.map((ev) => {
                const on = whEvents.includes(ev);
                return (
                  <Button
                    key={ev}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    onClick={() =>
                      setWhEvents((prev) =>
                        on ? prev.filter((x) => x !== ev) : [...prev, ev],
                      )
                    }
                  >
                    {ev}
                  </Button>
                );
              })}
            </div>
            <Button
              type="button"
              disabled={pending || !whUrl.trim()}
              onClick={() =>
                run(() =>
                  upsertTrackingWebhookAction({
                    label: whLabel || "Webhook",
                    url: whUrl,
                    secret: whSecret,
                    isActive: true,
                    events: whEvents,
                  }),
                )
              }
            >
              <Plus className="size-3.5" />
              Adicionar webhook
            </Button>
          </div>
          <ul className="space-y-2">
            {bundle.webhooks.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2"
              >
                <div>
                  <p className="font-medium">{w.label || "Webhook"}</p>
                  <p className="text-xs text-muted-foreground break-all">
                    {w.url}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(w.events || []).join(", ")}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => deleteTrackingWebhookAction(w.id))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

    </div>
  );
}
