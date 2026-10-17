import type { StoryCast } from "@/lib/stories/story-cast";

type ChapterLike = {
  index: number;
  title: string;
  text: string;
  imagePrompt: string;
};
import {
  STORY_AUX_MODEL,
  STORYTELLER_SKILL,
} from "@/lib/stories/storyteller-skill";
import { meteredChatCompletion } from "@/lib/usage/openai-meter";

export type SceneBibleEntry = {
  actIndex: number;
  beat: string;
  expression: string;
  wardrobe: {
    hat: boolean | null;
    backpack: boolean | null;
    companionInsideBag: boolean | null;
    notes: string;
  };
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
  return {
    actIndex: Number.isInteger(Number(r.actIndex ?? r.index))
      ? Number(r.actIndex ?? r.index)
      : index,
    beat,
    expression: String(r.expression ?? "atenta").trim() || "atenta",
    wardrobe: {
      hat: parseBoolish(wardrobeRaw.hat ?? wardrobeRaw.chapeu),
      backpack: parseBoolish(wardrobeRaw.backpack ?? wardrobeRaw.mochila),
      companionInsideBag: parseBoolish(
        wardrobeRaw.companionInsideBag ?? wardrobeRaw.bingoInside,
      ),
      notes: String(wardrobeRaw.notes ?? "").trim(),
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
 * e acumula prop locks (chapéu, mochila, Bingo dentro/fora…).
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
Regras:
- beat = ação literal do texto (não invente).
- expression: preocupada | resistente | atenta | alegre | curiosa | corajosa | emocionada…
- wardrobe: chapéu sim/não, mochila, companheiro (pet/toy) dentro/fora da bolsa.
- Se o texto coloca o chapéu no ato N, ele permanece nos atos seguintes até o texto dizer o contrário.
- NPCs vulneráveis (ex.: morador de rua): realistas — cobertores, pertences, aparência desgastada; NÃO "vovô limpo".
- must_show / must_not_show: props e elementos obrigatórios / proibidos.
- Último ato: cena rica se o texto cobrir (parque, lanche, alegria, amigos) — não só close-up na cama.
- Não contradiga o avatar da criança (sem inventar olhos de botão etc.).

Responda SOMENTE JSON:
{
  "acts": [
    {
      "actIndex": 0,
      "beat": string,
      "expression": string,
      "wardrobe": {
        "hat": boolean|null,
        "backpack": boolean|null,
        "companionInsideBag": boolean|null,
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

Gere a Continuity Bible agora.`,
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

    // Acumula locks de wardrobe ao longo dos atos
    const cumulativeLocks: string[] = [];
    let hatOn: boolean | null = null;
    let backpackOn: boolean | null = null;
    let companionIn: boolean | null = null;

    for (const act of acts) {
      if (act.wardrobe.hat != null) hatOn = act.wardrobe.hat;
      if (act.wardrobe.backpack != null) backpackOn = act.wardrobe.backpack;
      if (act.wardrobe.companionInsideBag != null) {
        companionIn = act.wardrobe.companionInsideBag;
      }
      const locks: string[] = [...act.propLocks];
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
        locks.push(`${input.cast.friendName} visible beside the child, outside bag`);
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

/** Injeta bible + locks no image_prompt de cada capítulo. */
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
    const enrichment = [
      `CONTINUITY BEAT: ${act.beat}`,
      `EXPRESSION: ${act.expression}`,
      `ENVIRONMENT: ${act.environment || "match story text"}`,
      `CAST VISIBLE: ${act.castVisible.join(", ") || "as in text"}`,
      lockLine,
      must,
      mustNot,
      npc,
      "Match the literal story beat; do not invent contradictory avatar details.",
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
