import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { dispatchTrackingEvent } from "@/lib/tracking/dispatch";
import { TRACKING_EVENT_KEYS, type TrackingEventKey } from "@/lib/tracking/types";

function isEventKey(v: unknown): v is TrackingEventKey {
  return typeof v === "string" && (TRACKING_EVENT_KEYS as string[]).includes(v);
}

function clientIpFromHeaders(h: Headers): string | null {
  const xf = h.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || null;
  return h.get("x-real-ip") || h.get("cf-connecting-ip");
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!isEventKey(body.event)) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }

  const h = await headers();
  const eventId =
    typeof body.eventId === "string" && body.eventId
      ? body.eventId
      : crypto.randomUUID();

  const user =
    body.user && typeof body.user === "object"
      ? (body.user as Record<string, unknown>)
      : {};
  const commerce =
    body.commerce && typeof body.commerce === "object"
      ? (body.commerce as Record<string, unknown>)
      : {};
  const attribution =
    body.attribution && typeof body.attribution === "object"
      ? (body.attribution as Record<string, unknown>)
      : {};

  const result = await dispatchTrackingEvent({
    event: body.event,
    eventId,
    eventSourceUrl:
      typeof body.eventSourceUrl === "string"
        ? body.eventSourceUrl
        : undefined,
    attribution: attribution as never,
    user: {
      email: typeof user.email === "string" ? user.email : null,
      phone: typeof user.phone === "string" ? user.phone : null,
      fullName: typeof user.fullName === "string" ? user.fullName : null,
      firstName: typeof user.firstName === "string" ? user.firstName : null,
      lastName: typeof user.lastName === "string" ? user.lastName : null,
      userId: typeof user.userId === "string" ? user.userId : null,
    },
    commerce: {
      product: typeof commerce.product === "string" ? commerce.product : null,
      planId: typeof commerce.planId === "string" ? commerce.planId : null,
      value: typeof commerce.value === "number" ? commerce.value : null,
      currency:
        typeof commerce.currency === "string" ? commerce.currency : "BRL",
      stripeSessionId:
        typeof commerce.stripeSessionId === "string"
          ? commerce.stripeSessionId
          : null,
    },
    clientIp: clientIpFromHeaders(h),
    userAgent: h.get("user-agent"),
    serverOnly: true,
  });

  return NextResponse.json({ ok: result.ok, eventId: result.eventId });
}
