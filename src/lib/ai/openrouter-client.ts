/**
 * Cliente único de IA — OpenRouter como gateway (API compatível OpenAI).
 * Fallback temporário: OPENAI_API_KEY direto se OpenRouter ausente.
 */

export type AiProvider = "openrouter" | "openai";

export type AiCredentials = {
  apiKey: string;
  provider: AiProvider;
  baseUrl: string;
};

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OPENAI_BASE = "https://api.openai.com/v1";

export function getAiCredentials(): AiCredentials | null {
  const openRouter = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouter) {
    return {
      apiKey: openRouter,
      provider: "openrouter",
      baseUrl: OPENROUTER_BASE,
    };
  }
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return {
      apiKey: openai,
      provider: "openai",
      baseUrl: OPENAI_BASE,
    };
  }
  return null;
}

export function aiKeyPresent(): boolean {
  return getAiCredentials() !== null;
}

/** Mensagem amigável quando falta chave (sem expor nomes de infra na UI pública se possível). */
export function missingAiKeyMessage(): string {
  return "Não consegui gerar com a IA agora. Confira OPENROUTER_API_KEY no .env e tente de novo.";
}

export function aiAuthHeaders(creds: AiCredentials): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.apiKey}`,
  };
  if (creds.provider === "openrouter") {
    const referer =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.OPENROUTER_HTTP_REFERER?.trim() ||
      "http://127.0.0.1:5050";
    headers["HTTP-Referer"] = referer;
    headers["X-Title"] =
      process.env.OPENROUTER_APP_TITLE?.trim() || "Euzim";
  }
  return headers;
}

export type ChatCompletionResult = {
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
  content: string | null;
  error?: string;
  /** Custo USD reportado pelo OpenRouter (usage.cost), se houver. */
  nativeCostUsd?: number;
};

export async function chatViaOpenRouter(input: {
  body: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<ChatCompletionResult> {
  const creds = getAiCredentials();
  if (!creds) {
    return {
      ok: false,
      status: 0,
      json: { error: "no key" },
      content: null,
      error: "OPENROUTER_API_KEY ausente",
    };
  }

  const model = String(input.body.model ?? "openai/gpt-4o");
  try {
    const res = await fetch(`${creds.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        ...aiAuthHeaders(creds),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.body),
      signal: AbortSignal.timeout(input.timeoutMs ?? 180_000),
    });

    let json: Record<string, unknown> = {};
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        status: res.status,
        json: {},
        content: null,
        error: `IA respondeu sem JSON (${res.status})`,
      };
    }

    const content =
      (
        json.choices as { message?: { content?: string } }[] | undefined
      )?.[0]?.message?.content ?? null;

    const apiErr =
      typeof (json.error as { message?: string } | undefined)?.message ===
      "string"
        ? (json.error as { message: string }).message
        : undefined;

    const usage = json.usage as { cost?: number } | undefined;
    const nativeCostUsd =
      typeof usage?.cost === "number" && Number.isFinite(usage.cost)
        ? usage.cost
        : undefined;

    if (!res.ok) {
      console.error(
        `[ai:${creds.provider}] chat ${model} HTTP ${res.status}`,
        apiErr ?? "(sem detalhe)",
      );
    }

    return {
      ok: res.ok,
      status: res.status,
      json,
      content,
      error: res.ok ? undefined : apiErr || `IA HTTP ${res.status}`,
      nativeCostUsd,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha de rede na IA";
    console.error(`[ai:${creds.provider}] chat ${model} throw`, message);
    return {
      ok: false,
      status: 0,
      json: { error: message },
      content: null,
      error: message,
    };
  }
}

export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

export function sizeToAspectRatio(
  size: ImageSize | string,
): "1:1" | "2:3" | "3:2" {
  switch (size) {
    case "1024x1536":
      return "2:3";
    case "1536x1024":
      return "3:2";
    case "1024x1024":
      return "1:1";
    default:
      return "1:1";
  }
}

export type ImageGenerationResult = {
  ok: boolean;
  status: number;
  buffer: Buffer | null;
  error?: string;
  nativeCostUsd?: number;
  json: Record<string, unknown>;
};

/**
 * Gera/edita imagem via OpenRouter Image API (`/images`) ou
 * fallback OpenAI (`/images/edits` | `/images/generations`).
 */
export async function imageViaOpenRouter(input: {
  model: string;
  prompt: string;
  /** JPEG buffers de referência (edit). */
  referenceImages?: Buffer[];
  size?: ImageSize | string;
  quality?: "low" | "medium" | "high" | "auto" | "standard";
  timeoutMs?: number;
}): Promise<ImageGenerationResult> {
  const creds = getAiCredentials();
  if (!creds) {
    return {
      ok: false,
      status: 0,
      buffer: null,
      error: "OPENROUTER_API_KEY ausente",
      json: {},
    };
  }

  const quality =
    input.quality === "standard" ? "medium" : (input.quality ?? "medium");
  const size = (input.size ?? "1024x1024") as ImageSize;
  const refs = input.referenceImages ?? [];

  try {
    if (creds.provider === "openrouter") {
      return await openRouterImages({
        creds,
        model: input.model,
        prompt: input.prompt,
        refs,
        size,
        quality: quality === "auto" ? "auto" : quality,
        timeoutMs: input.timeoutMs,
      });
    }
    return await openaiImages({
      creds,
      model: input.model.includes("/")
        ? input.model.split("/").pop()!
        : input.model,
      prompt: input.prompt,
      refs,
      size,
      quality: quality === "auto" ? "medium" : quality,
      timeoutMs: input.timeoutMs,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha de rede na IA (imagem)";
    console.error(`[ai:${creds.provider}] image throw`, message);
    return {
      ok: false,
      status: 0,
      buffer: null,
      error: message,
      json: {},
    };
  }
}

async function openRouterImages(input: {
  creds: AiCredentials;
  model: string;
  prompt: string;
  refs: Buffer[];
  size: ImageSize;
  quality: "low" | "medium" | "high" | "auto";
  timeoutMs?: number;
}): Promise<ImageGenerationResult> {
  const body: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    n: 1,
    aspect_ratio: sizeToAspectRatio(input.size),
    quality: input.quality,
  };
  if (input.refs.length > 0) {
    body.input_references = input.refs.map((buf) => ({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${buf.toString("base64")}`,
      },
    }));
  }

  const res = await fetch(`${input.creds.baseUrl}/images`, {
    method: "POST",
    headers: {
      ...aiAuthHeaders(input.creds),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(input.timeoutMs ?? 180_000),
  });

  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      status: res.status,
      buffer: null,
      error: `IA imagem sem JSON (${res.status})`,
      json: {},
    };
  }

  if (!res.ok) {
    const apiErr =
      typeof (json.error as { message?: string } | undefined)?.message ===
      "string"
        ? (json.error as { message: string }).message
        : `IA images HTTP ${res.status}`;
    console.error(`[ai:openrouter] image ${input.model} HTTP ${res.status}`);
    return { ok: false, status: res.status, buffer: null, error: apiErr, json };
  }

  const usage = json.usage as { cost?: number } | undefined;
  const nativeCostUsd =
    typeof usage?.cost === "number" && Number.isFinite(usage.cost)
      ? usage.cost
      : undefined;

  const data = json.data as
    | { b64_json?: string; url?: string }[]
    | undefined;
  const b64 = data?.[0]?.b64_json;
  if (b64) {
    return {
      ok: true,
      status: res.status,
      buffer: Buffer.from(b64, "base64"),
      nativeCostUsd,
      json,
    };
  }
  const url = data?.[0]?.url;
  if (url) {
    const remote = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (remote.ok) {
      return {
        ok: true,
        status: res.status,
        buffer: Buffer.from(await remote.arrayBuffer()),
        nativeCostUsd,
        json,
      };
    }
  }
  return {
    ok: false,
    status: res.status,
    buffer: null,
    error: "Resposta da IA sem imagem.",
    json,
  };
}

async function openaiImages(input: {
  creds: AiCredentials;
  model: string;
  prompt: string;
  refs: Buffer[];
  size: ImageSize;
  quality: "low" | "medium" | "high";
  timeoutMs?: number;
}): Promise<ImageGenerationResult> {
  if (input.refs.length > 0) {
    const form = new FormData();
    form.set("model", input.model);
    form.set("prompt", input.prompt);
    form.set("size", input.size);
    form.set("quality", input.quality);
    form.set("output_format", "jpeg");
    if (input.model.includes("gpt-image-1")) {
      form.set("input_fidelity", "high");
    }
    input.refs.forEach((buf, i) => {
      form.append(
        "image[]",
        new File([new Uint8Array(buf)], `ref-${i}.jpg`, {
          type: "image/jpeg",
        }),
      );
    });
    const res = await fetch(`${input.creds.baseUrl}/images/edits`, {
      method: "POST",
      headers: aiAuthHeaders(input.creds),
      body: form,
      signal: AbortSignal.timeout(input.timeoutMs ?? 180_000),
    });
    return parseOpenAiImageResponse(res, input.model);
  }

  const res = await fetch(`${input.creds.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      ...aiAuthHeaders(input.creds),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model.startsWith("dall-e") ? input.model : input.model,
      prompt: input.prompt,
      size: input.size === "1024x1024" ? "1024x1024" : "1024x1024",
      quality: input.quality === "low" ? "standard" : "hd",
      n: 1,
    }),
    signal: AbortSignal.timeout(input.timeoutMs ?? 180_000),
  });
  return parseOpenAiImageResponse(res, input.model);
}

async function parseOpenAiImageResponse(
  res: Response,
  model: string,
): Promise<ImageGenerationResult> {
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      status: res.status,
      buffer: null,
      error: `IA imagem sem JSON (${res.status})`,
      json: {},
    };
  }
  if (!res.ok) {
    const apiErr =
      typeof (json.error as { message?: string } | undefined)?.message ===
      "string"
        ? (json.error as { message: string }).message
        : `IA images HTTP ${res.status}`;
    console.error(`[ai:openai] image ${model} HTTP ${res.status}`);
    return { ok: false, status: res.status, buffer: null, error: apiErr, json };
  }
  const data = json.data as
    | { b64_json?: string; url?: string }[]
    | undefined;
  const b64 = data?.[0]?.b64_json;
  if (b64) {
    return {
      ok: true,
      status: res.status,
      buffer: Buffer.from(b64, "base64"),
      json,
    };
  }
  const url = data?.[0]?.url;
  if (url) {
    const remote = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (remote.ok) {
      return {
        ok: true,
        status: res.status,
        buffer: Buffer.from(await remote.arrayBuffer()),
        json,
      };
    }
  }
  return {
    ok: false,
    status: res.status,
    buffer: null,
    error: "Resposta da IA sem imagem.",
    json,
  };
}
