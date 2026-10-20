/**
 * Preview rápido de avatar no onboarding.
 * Tenta Image API (OpenRouter) se houver chave; senão placeholder premium.
 */
import { modelForActivity } from "@/lib/ai/model-registry";
import { imageViaOpenRouter } from "@/lib/ai/openrouter-client";

export async function generateAvatarPreview(input: {
  subjectName: string;
  kind: "child" | "pet" | "toy";
}): Promise<{ url: string; engine: "openai-image" | "placeholder" }> {
  const hasKey = Boolean(
    process.env.OPENROUTER_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim(),
  );

  if (hasKey) {
    try {
      const prompt =
        input.kind === "child"
          ? `Wholesome Walt Disney / Pixar style 3D bust portrait of a child named "${input.subjectName}", soft cinematic lighting, pastel magical background, friendly expression, family-friendly. No text, no watermark.`
          : input.kind === "pet"
            ? `Wholesome Pixar-style 3D hero portrait of a pet named "${input.subjectName}", soft studio lighting, clean background. No text, no watermark, no people.`
            : `Cute Pixar-style 3D toy sidekick named "${input.subjectName}", colorful, wholesome kids movie style. No text, no watermark, no people.`;

      const result = await imageViaOpenRouter({
        model: modelForActivity("avatar_preview"),
        prompt,
        size: "1024x1024",
        quality: "low",
      });

      if (result.ok && result.buffer) {
        const b64 = result.buffer.toString("base64");
        return {
          url: `data:image/jpeg;base64,${b64}`,
          engine: "openai-image",
        };
      }
    } catch {
      // fallback
    }
  }

  const seed = encodeURIComponent(input.subjectName.slice(0, 24) || "magic");
  const url =
    input.kind === "child"
      ? `https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80&sig=${seed}`
      : input.kind === "pet"
        ? `https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=800&q=80&sig=${seed}`
        : `https://images.unsplash.com/photo-1558060370-d644479cb6f7?auto=format&fit=crop&w=800&q=80&sig=${seed}`;

  return { url, engine: "placeholder" };
}
