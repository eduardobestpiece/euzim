import type { StoryCast } from "@/lib/stories/story-cast";
import {
  STORY_AUX_MODEL,
  STORYTELLER_SKILL,
} from "@/lib/stories/storyteller-skill";
import { meteredChatCompletion } from "@/lib/usage/openai-meter";

type ChapterLike = {
  index: number;
  title: string;
  text: string;
  imagePrompt: string;
};

export type SceneWardrobe = {
  /** Descrição explícita da roupa do ato (ex.: "yellow raincoat + hat", "striped pajamas"). */
  outfit: string;
  hat: boolean | null;
  backpack: boolean | null;
  companionInsideBag: boolean | null;
  notes: string;
  /** Se true, manter a mesma outfit do ato anterior (texto não mudou de contexto). */
  keepFromPrevious: boolean;
};

export type SceneBibleEntry = {
  actIndex: number;
  beat: string;
  expression: string;
  wardrobe: SceneWardrobe;
  castVisible: string[];
  environment: string;
  mustShow: string[];
  mustNotShow: string[];
  npcNotes: string;
  propLocks: string[];
};

export type ContinuityBible = {
  acts: SceneBibleEntry[];
  cumulativeLocks: string[];
};

function parseBoolish(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase();
    if (["true", "yes", "sim", "on"].includes(s)) return true;
    if (["false", "no", "nao", "não", "off"].includes(s)) return false;
  }
  return null;
}

function parseAct(raw: unknown, index: number): SceneBibleEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const wardrobeRaw =
    r.wardrobe && typeof r.wardrobe === "object"
      ? (r.wardrobe as Record<string, unknown>)
      : {};
  const beat = String(r.beat ?? "").trim();
  if (!beat) return null;

  const outfit = String(
    wardrobeRaw.outfit ??
      wardrobeRaw.clothing ??
      wardrobeRaw.clothes ??
      wardrobeRaw.notes ??
      "",
  ).trim();

  return {
    actIndex: Number.isInteger(Number(r.actIndex ?? r.index))
      ? Number(r.actIndex ?? r.index)
      : index,
    beat,
    expression: String(r.expression ?? "atenta").trim() || "atenta",
    wardrobe: {
      outfit,
      hat: parseBoolish(wardrobeRaw.hat ?? wardrobeRaw.chapeu),
      backpack: parseBoolish(wardrobeRaw.backpack ?? wardrobeRaw.mochila),
      companionInsideBag: parseBoolish(
        wardrobeRaw.companionInsideBag ?? wardrobeRaw.bingoInside,
      ),
      notes: String(wardrobeRaw.notes ?? "").trim(),
      keepFromPrevious: Boolean(
        wardrobeRaw.keepFromPrevious ??
          wardrobeRaw.keep_from_previous ??
          wardrobeRaw.sameAsPrevious,
      ),
    },
    castVisible: Array.isArray(r.cast_visible)
      ? r.cast_visible.map(String)
      : Array.isArray(r.castVisible)
        ? r.castVisible.map(String)
        : [],
    environment: String(r.environment ?? "").trim(),
    mustShow: Array.isArray(r.must_show)
      ? r.must_show.map(String)
      : Array.isArray(r.mustShow)
        ? r.mustShow.map(String)
        : [],
    mustNotShow: Array.isArray(r.must_not_show)
      ? r.must_not_show.map(String)
      : Array.isArray(r.mustNotShow)
        ? r.mustNotShow.map(String)
        : [],
    npcNotes: String(r.npc_notes ?? r.npcNotes ?? "").trim(),
    propLocks: Array.isArray(r.prop_locks)
      ? r.prop_locks.map(String)
      : Array.isArray(r.propLocks)
        ? r.propLocks.map(String)
        : [],
  };
}

/**
 * Após o split dos atos, gera a Scene Continuity Bible (JSON por ato)
 * com wardrobe explícito + prop locks acumulados.
 */
export async function buildSceneContinuityBible(input: {
  userId?: string | null;
  cast: StoryCast;
  title: string;
  chapters: ChapterLike[];
}): Promise<ContinuityBible | null> {
  const digest = input.chapters
    .map(
      (c, i) =>
        `ATO ${i + 1} — ${c.title}\nTexto: ${c.text.slice(0, 700)}\nPrompt atual: ${c.imagePrompt.slice(0, 280)}`,
    )
    .join("\n\n");

  const result = await meteredChatCompletion({
    userId: input.userId,
    category: "story_text",
    operation: "scene_continuity_bible",
    body: {
      model: STORY_AUX_MODEL,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${STORYTELLER_SKILL}

Você é o diretor de continuidade visual (Scene Continuity Bible).
Para CADA ato, produza um JSON estruturado que a ilustração DEVE obedecer.

## Identidade vs roupa (CRÍTICO)
- O avatar Pixar define ROSTO, CABELO, CORPO e identidade — NÃO a roupa do turnaround/sheet.
- A ROUPA (wardrobe.outfit) DEVE seguir o beat/texto do ato e o contexto da cena.
  Exemplos: chapéu + casaco no parque; pijama na cama; outra roupa em visitas/lanche; roupa de passeio na rua.
- NUNCA force "sempre a mesma blusa do avatar". Se o texto muda de cena/contexto, mude a roupa.
- Se o texto mantém a mesma saída/atividade, use keepFromPrevious=true e a MESMA outfit.

## Outras regras
- beat = ação literal do texto (não invente).
- expression: preocupada | resistente | atenta | alegre | curiosa | corajosa | emocionada…
- wardrobe.outfit: descrição CURTA em inglês da roupa completa do ato (cores + peças).
- wardrobe: hat, backpack, companionInsideBag (pet/toy dentro/fora da bolsa).
- Se o texto coloca o chapéu no ato N, permanece nos atos seguintes até o texto dizer o contrário.
- NPCs vulneráveis (ex.: morador de rua): realistas — cobertores, pertences, aparência desgastada; NÃO "vovô limpo".
- must_show / must_not_show: props e elementos obrigatórios / proibidos.
- Último ato: cena rica se o texto cobrir (parque, lanche, alegria) — não só close-up na cama.
- Não invente detalhes de rosto/cabelo que contradigam o avatar.

Responda SOMENTE JSON:
{
  "acts": [
    {
      "actIndex": 0,
      "beat": string,
      "expression": string,
      "wardrobe": {
        "outfit": string,
        "hat": boolean|null,
        "backpack": boolean|null,
        "companionInsideBag": boolean|null,
        "keepFromPrevious": boolean,
        "notes": string
      },
      "cast_visible": string[],
      "environment": string,
      "must_show": string[],
      "must_not_show": string[],
      "npc_notes": string,
      "prop_locks": string[]
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Criança: ${input.cast.childName}
Amigo (${input.cast.friendKind}): ${input.cast.friendName}
Título: ${input.title}

ATOS:
${digest}

Gere a Continuity Bible agora. Outfit por ato coerente com o texto (não a blusa fixa do sheet).`,
        },
      ],
    },
    timeoutMs: 90_000,
  });

  if (!result.ok || !result.content) return null;
  try {
    const parsed = JSON.parse(result.content) as { acts?: unknown };
    const rawActs = Array.isArray(parsed.acts) ? parsed.acts : [];
    const acts: SceneBibleEntry[] = [];
    for (let i = 0; i < rawActs.length; i++) {
      const entry = parseAct(rawActs[i], i);
      if (entry) acts.push(entry);
    }
    if (acts.length === 0) return null;

    // Acumula locks de wardrobe / outfit ao longo dos atos
    const cumulativeLocks: string[] = [];
    let hatOn: boolean | null = null;
    let backpackOn: boolean | null = null;
    let companionIn: boolean | null = null;
    let lockedOutfit: string | null = null;

    for (let i = 0; i < acts.length; i++) {
      const act = acts[i];
      if (act.wardrobe.hat != null) hatOn = act.wardrobe.hat;
      if (act.wardrobe.backpack != null) backpackOn = act.wardrobe.backpack;
      if (act.wardrobe.companionInsideBag != null) {
        companionIn = act.wardrobe.companionInsideBag;
      }

      // Outfit: lock se keepFromPrevious ou se texto não trocou e já havia outfit
      if (act.wardrobe.keepFromPrevious && lockedOutfit) {
        act.wardrobe.outfit = lockedOutfit;
      } else if (act.wardrobe.outfit) {
        lockedOutfit = act.wardrobe.outfit;
      } else if (lockedOutfit) {
        act.wardrobe.outfit = lockedOutfit;
        act.wardrobe.keepFromPrevious = true;
      } else if (!act.wardrobe.outfit) {
        // Fallback mínimo por ambiente se o modelo omitir
        const env = act.environment.toLowerCase();
        const beat = act.beat.toLowerCase();
        if (
          env.includes("bed") ||
          env.includes("cama") ||
          beat.includes("pijama") ||
          beat.includes("pajama") ||
          beat.includes("dorm")
        ) {
          act.wardrobe.outfit = "cozy striped pajamas";
        } else if (
          env.includes("park") ||
          env.includes("parque") ||
          beat.includes("chapéu") ||
          beat.includes("hat")
        ) {
          act.wardrobe.outfit =
            "casual outdoor play clothes with a matching hat";
        } else {
          act.wardrobe.outfit =
            "age-appropriate casual clothes matching this scene (not the default avatar shirt)";
        }
        lockedOutfit = act.wardrobe.outfit;
      }

      const locks: string[] = [...act.propLocks];
      if (act.wardrobe.outfit) {
        locks.push(
          `child outfit THIS act: ${act.wardrobe.outfit}` +
            (act.wardrobe.keepFromPrevious
              ? " (same as previous act — continuity lock)"
              : " (changed for this scene/context)"),
        );
      }
      if (hatOn === true) locks.push("child wearing the same hat from earlier acts");
      if (hatOn === false) locks.push("child without hat");
      if (backpackOn === true) locks.push("child wearing the same backpack");
      if (backpackOn === false) locks.push("child without backpack");
      if (companionIn === true) {
        locks.push(
          `${input.cast.friendName} inside bag/backpack (not free-standing)`,
        );
      }
      if (companionIn === false) {
        locks.push(
          `${input.cast.friendName} visible beside the child, outside bag`,
        );
      }
      act.propLocks = Array.from(new Set(locks));
      for (const lock of act.propLocks) {
        if (!cumulativeLocks.includes(lock)) cumulativeLocks.push(lock);
      }
    }

    return { acts, cumulativeLocks };
  } catch {
    return null;
  }
}

/** Injeta bible + wardrobe + locks no image_prompt de cada capítulo. */
export function applyBibleToChapters<T extends ChapterLike>(
  chapters: T[],
  bible: ContinuityBible | null,
): T[] {
  if (!bible) return chapters;
  return chapters.map((chapter, i) => {
    const act =
      bible.acts.find((a) => a.actIndex === i) ?? bible.acts[i] ?? null;
    if (!act) return chapter;
    const lockLine = act.propLocks.length
      ? `PROP LOCKS: ${act.propLocks.join("; ")}.`
      : "";
    const must = act.mustShow.length
      ? `MUST SHOW: ${act.mustShow.join("; ")}.`
      : "";
    const mustNot = act.mustNotShow.length
      ? `MUST NOT SHOW: ${act.mustNotShow.join("; ")}.`
      : "";
    const npc = act.npcNotes ? `NPC NOTES: ${act.npcNotes}.` : "";
    const outfitLine = act.wardrobe.outfit
      ? `WARDROBE OUTFIT: ${act.wardrobe.outfit}.${
          act.wardrobe.keepFromPrevious
            ? " Keep same outfit as previous act."
            : " Outfit follows THIS story beat/scene — not the default avatar shirt from the reference sheet."
        }`
      : "";
    const enrichment = [
      `CONTINUITY BEAT: ${act.beat}`,
      `EXPRESSION: ${act.expression}`,
      outfitLine,
      `ENVIRONMENT: ${act.environment || "match story text"}`,
      `CAST VISIBLE: ${act.castVisible.join(", ") || "as in text"}`,
      lockLine,
      must,
      mustNot,
      npc,
      "Identity from avatar refs (face, hair, body). Clothing from WARDROBE OUTFIT for this act.",
      "Match the literal story beat; do not invent contradictory avatar face/hair details.",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      ...chapter,
      imagePrompt: `${chapter.imagePrompt}\n${enrichment}`.trim(),
    };
  });
}

export function biblePromptFragment(
  bible: ContinuityBible | null,
  pageIndex: number,
): string {
  if (!bible) return "";
  const act =
    bible.acts.find((a) => a.actIndex === pageIndex) ?? bible.acts[pageIndex];
  if (!act) return "";
  return [
    `Continuity beat: ${act.beat}.`,
    `Child expression: ${act.expression}.`,
    act.wardrobe.outfit
      ? `Wardrobe outfit: ${act.wardrobe.outfit}.`
      : "",
    act.propLocks.length ? `Locked props: ${act.propLocks.join("; ")}.` : "",
    act.mustShow.length ? `Must show: ${act.mustShow.join("; ")}.` : "",
    act.mustNotShow.length
      ? `Must not show: ${act.mustNotShow.join("; ")}.`
      : "",
    act.npcNotes ? `NPC: ${act.npcNotes}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
