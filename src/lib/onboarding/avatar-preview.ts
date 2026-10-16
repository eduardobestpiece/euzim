/**
 * Gera preview “Disney-like” do avatar.
 * Tenta OpenAI Images se OPENAI_API_KEY existir; senão placeholder premium.
 */

export async function generateAvatarPreview(input: {
  subjectName: string;
  kind: "child" | "pet" | "toy";
  referenceHint?: string;
}): Promise<{ url: string; engine: "openai-image" | "placeholder" }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    try {
      const subject =
        input.kind === "child"
          ? `a joyful child named ${input.subjectName}`
          : input.kind === "pet"
            ? `a cute pet companion named ${input.subjectName}`
            : `a beloved favorite toy named ${input.subjectName}`;

      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: `Wholesome Pixar/Disney-inspired storybook character portrait of ${subject}, soft cinematic lighting, pastel magical background, friendly expression, family-friendly, high quality illustration, no text, no watermark`,
          size: "1024x1024",
          quality: "standard",
          n: 1,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          data?: { url?: string; b64_json?: string }[];
        };
        const url = data.data?.[0]?.url;
        if (url) return { url, engine: "openai-image" };
        const b64 = data.data?.[0]?.b64_json;
        if (b64) {
          return {
            url: `data:image/png;base64,${b64}`,
            engine: "openai-image",
          };
        }
      }
    } catch {
      // fallback
    }
  }

  // Placeholder premium: Unsplash kids/adventure + query params
  const seed = encodeURIComponent(input.subjectName.slice(0, 24) || "magic");
  const url =
    input.kind === "child"
      ? `https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80&sig=${seed}`
      : input.kind === "pet"
        ? `https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=800&q=80&sig=${seed}`
        : `https://images.unsplash.com/photo-1558060370-d644479cb6f7?auto=format&fit=crop&w=800&q=80&sig=${seed}`;

  return { url, engine: "placeholder" };
}
