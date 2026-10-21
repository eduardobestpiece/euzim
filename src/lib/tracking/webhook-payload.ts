import {
  normalizeEmail,
  normalizePhoneE164Digits,
  splitName,
  toTitleCaseName,
} from "@/lib/tracking/hash";
import {
  WEBHOOK_EVENT_LABELS,
  type TrackingEventInput,
} from "@/lib/tracking/types";

/** Datas em DD/MM/YYYY e hora HH:mm:ss no fuso America/Sao_Paulo. */
export function brazilDateParts(now = new Date()): {
  data: string;
  hora: string;
  data_hora: string;
} {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || "";
  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");
  const data = `${day}/${month}/${year}`;
  const hora = `${hour}:${minute}:${second}`;
  return { data, hora, data_hora: `${data} ${hora}` };
}

export function buildWebhookPayload(
  input: TrackingEventInput,
): Record<string, unknown> {
  const { data, hora, data_hora } = brazilDateParts();
  const names = splitName(
    input.user?.fullName ||
      [input.user?.firstName, input.user?.lastName].filter(Boolean).join(" "),
  );
  const email = normalizeEmail(input.user?.email);
  const telefone = normalizePhoneE164Digits(input.user?.phone);
  const attr = input.attribution || {};

  const payload: Record<string, unknown> = {
    data,
    hora,
    data_hora,
    evento: WEBHOOK_EVENT_LABELS[input.event],
  };

  if (names.fullName) payload.nome_completo = names.fullName;
  if (names.firstName) payload.primeiro_nome = names.firstName;
  if (names.lastName) payload.sobrenome = names.lastName;
  if (email) payload.email = email;
  if (telefone) payload.telefone = telefone;
  if (input.commerce?.product) {
    payload.produto = toTitleCaseName(input.commerce.product) || input.commerce.product;
  }
  if (input.commerce?.value != null) payload.valor = input.commerce.value;
  if (input.eventSourceUrl) payload.url = input.eventSourceUrl;
  if (attr.landing_query) payload.parametros_url = attr.landing_query;
  if (input.clientIp) payload.ip = input.clientIp;
  if (attr.utm_source) payload.utm_source = attr.utm_source;
  if (attr.utm_medium) payload.utm_medium = attr.utm_medium;
  if (attr.utm_campaign) payload.utm_campaign = attr.utm_campaign;
  if (attr.utm_term) payload.utm_term = attr.utm_term;
  if (attr.utm_content) payload.utm_content = attr.utm_content;
  if (attr.gclid) payload.gclid = attr.gclid;
  if (attr.fbclid) payload.fbclid = attr.fbclid;
  if (attr.fbc) payload.fbc = attr.fbc;
  if (attr.fbp) payload.fbp = attr.fbp;
  if (input.userAgent) payload.user_agent = input.userAgent;
  if (input.commerce?.planId) payload.plan_id = input.commerce.planId;
  if (input.commerce?.stripeSessionId) {
    payload.stripe_session_id = input.commerce.stripeSessionId;
  }
  if (input.user?.userId) payload.user_id = input.user.userId;
  if (input.eventId) payload.event_id = input.eventId;

  // Remove undefined / null / empty
  for (const key of Object.keys(payload)) {
    const v = payload[key];
    if (v == null || v === "") delete payload[key];
  }

  return payload;
}
