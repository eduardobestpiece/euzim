import { NextResponse } from "next/server";
import { hasSecretKey, isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "euzim",
      port: 5050,
      supabaseConfigured: isSupabaseConfigured(),
      hasSecretKey: hasSecretKey(),
      projectRef: "zlzgkivktvnyvehjwcjw",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
