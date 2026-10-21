/** Eventos canônicos (Meta + pipeline interno). */
export type TrackingEventKey =
  | "PageView"
  | "ViewContent"
  | "Lead"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase"
  | "CompleteRegistration";

export const TRACKING_EVENT_KEYS: TrackingEventKey[] = [
  "PageView",
  "ViewContent",
  "Lead",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Purchase",
  "CompleteRegistration",
];

/** Labels PT no payload de webhook. */
export const WEBHOOK_EVENT_LABELS: Record<TrackingEventKey, string> = {
  PageView: "page_view",
  ViewContent: "ViewContent",
  Lead: "Lead",
  InitiateCheckout: "Iniciou Compra",
  AddPaymentInfo: "Adicionou Informações de Pagamento",
  Purchase: "Compra Realizada",
  CompleteRegistration: "Onboard Concluído",
};

export type GoogleAdsConversionKey =
  | "Lead"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase"
  | "CompleteRegistration";

export type AttributionSnapshot = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  referrer?: string | null;
  landing_path?: string | null;
  landing_query?: string | null;
};

export type TrackingUserPii = {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  userId?: string | null;
};

export type TrackingCommerce = {
  product?: string | null;
  planId?: string | null;
  value?: number | null;
  currency?: string;
  stripeSessionId?: string | null;
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
};

export type TrackingEventInput = {
  event: TrackingEventKey;
  eventId?: string;
  eventSourceUrl?: string;
  attribution?: AttributionSnapshot;
  user?: TrackingUserPii;
  commerce?: TrackingCommerce;
  clientIp?: string | null;
  userAgent?: string | null;
  /** true = só servidor (CAPI/webhooks); browser já disparou */
  serverOnly?: boolean;
};

export type TrackingPixelRow = {
  id: string;
  kind: "meta" | "google_ads" | "ga4";
  label: string;
  is_active: boolean;
  pixel_id: string | null;
  capi_access_token?: string | null;
  aw_id: string | null;
  conversion_labels: Record<string, string> | null;
  measurement_id: string | null;
};

export type TrackingTagRow = {
  id: string;
  name: string;
  html: string;
  is_active: boolean;
};

export type TrackingWebhookRow = {
  id: string;
  label: string;
  url: string;
  secret: string | null;
  is_active: boolean;
  events: string[];
};

export type PublicTrackingConfig = {
  metaPixelIds: string[];
  googleAds: Array<{
    awId: string;
    labels: Record<string, string>;
  }>;
  ga4Ids: string[];
  tags: Array<{ id: string; name: string; html: string }>;
};
