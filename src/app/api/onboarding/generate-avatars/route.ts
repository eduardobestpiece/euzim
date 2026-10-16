import { NextResponse } from "next/server";
import { generateAvatarsAction } from "@/lib/onboarding/actions";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Gera avatares Pixar (pode levar 1–3 min). */
export async function POST(request: Request) {
  let force = true;
  try {
    const body = (await request.json()) as { force?: boolean };
    if (typeof body.force === "boolean") force = body.force;
  } catch {
    /* body opcional */
  }

  const result = await generateAvatarsAction({ force });
  if (result.error) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
