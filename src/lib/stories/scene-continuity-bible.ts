import { modelForActivity } from "@/lib/ai/model-registry";
import type { StoryCast } from "@/lib/stories/story-cast";
import { STORYTELLER_SKILL } from "@/lib/stories/storyteller-skill";
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

export type NpcRosterEntry = {
  name: string;
  role: string;
  /** Aparência travada (inglês) para image prompts — nunca clone da protagonista. */
  appearance: string;
};

export type ContinuityBible = {
  acts: SceneBibleEntry[];
  cumulativeLocks: string[];
  npcRoster: NpcRosterEntry[];
  /** Âncora de ambiente/escala (ex.: sandbox com castelo de balde). */
  environmentAnchor: string;
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

function parseJsonLoose(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    /* continue */
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as Record<string, unknown>;
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
    } catch {
      /* continue */
    }
  }
  return null;
}

/**
 * Após o split dos atos, gera a Scene Continuity Bible (JSON por ato)
 * com wardrobe explícito, NPC roster travado e âncora de ambiente.
 */
export async function buildSceneContinuityBible(input: {
  userId?: string | null;
  cast: StoryCast;
  title: string;
  chapters: ChapterLike[];
  settingPreference?: string;
}): Promise<ContinuityBible | null> {
  const digest = input.chapters
    .map(
      (c, i) =>
        `ATO ${i + 1} — ${c.title}\nTexto: ${c.text.slice(0, 700)}\nPrompt atual: ${c.imagePrompt.slice(0, 280)}`,
    )
    .join("\n\n");

  const settingLine =
    input.settingPreference?.trim() ||
    "(nenhum — escolha e ancore o melhor ambiente para o tema)";

  const result = await meteredChatCompletion({
    userId: input.userId,
    category: "story_text",
    operation: "scene_continuity_bible",
    body: {
      model: modelForActivity("story_continuity"),
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
- NUNCA force "sempre a mesma blusa do avatar". Se o texto muda de cena/contexto, mude a roupa.
- Se o texto mantém a mesma saída/atividade, use keepFromPrevious=true e a MESMA outfit.
- DIA ESCOLAR: todos os atos de escola/pátio/recreio DEVEM usar a MESMA outfit (uniforme ou roupa escolar estável). Não alterne vestido floral / camiseta rosa / outra roupa no mesmo dia.
- Ambiente escolar: pátio/banco/quadra — NÃO invente caixa de areia na escola.

## ANTI-CLONE + NPC LOCK (CRÍTICO)
- Qualquer outra criança/NPC NUNCA pode parecer a protagonista "${input.cast.childName}".
- Defina npc_roster no JSON raiz: lista de {name, role, appearance} com aparência ÚNICA
  (cabelo diferente, roupa diferente, traços distintos) em inglês.
- Em CADA ato onde o NPC aparece: npc_notes DEVE repetir a MESMA appearance do roster.
- Proibido mudar o NPC de uma página para outra (cabelo/roupa/rosto).

## AMBIENTE / ESCALA
- environment_anchor no JSON raiz: lugar + escala estável
  (ex.: "neighborhood sandbox, child-sized sandcastle from a bucket mold").
- Castelo de areia NÃO cresce para fortaleza monumental sem o texto pedir.
- Se settingPreference vier preenchido, o ambiente DEVE segui-lo.
- must_not_show: incluir "protagonist twin/clone NPC" e "same framing as previous page".

## Outras regras
- beat = ação literal do texto (não invente).
- expression: preocupada | resistente | atenta | alegre | curiosa | corajosa | emocionada…
- wardrobe.outfit: descrição CURTA em inglês da roupa completa do ato (cores + peças).
- companion "${input.cast.friendName}": fidelidade TOTAL ao avatar Pixar (espécie/cores/forma). NUNCA substitua por coelho/urso genérico.
- ${input.cast.companionVisualLock || ""}
- beat e must_show DEVEM refletir SÓ o texto daquele ato (sem antecipar a cena do dia seguinte).
- Anatomia: poses claras; 2 braços/2 pernas; sem ângulos que quebrem articulações (exceto avatar com deficiência/cadeira).
- must_not_show: incluir "extra arms", "impossible limb bend", "back-view torso with front-view hug arm".
- Pais/irmãos sem avatar: body-only.
- Não invente detalhes de rosto/cabelo que contradigam o avatar da protagonista.

Responda SOMENTE JSON:
{
  "environment_anchor": string,
  "npc_roster": [
    { "name": string, "role": string, "appearance": string }
  ],
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
          content: `Criança protagonista: ${input.cast.childName} (avatar Pixar — NÃO clonar em NPCs).
Amigo (${input.cast.friendKind}, gender=${input.cast.friendGender}): ${input.cast.friendName}
${input.cast.companionVisualLock || ""}
Título: ${input.title}
settingPreference: ${settingLine}

ATOS:
${digest}

Gere a Continuity Bible agora.
- npc_roster com aparências únicas (nunca iguais à protagonista) e TRAVADAS em todos os atos.
- environment_anchor com escala estável; cada act.environment herda a âncora.
- Outfit por ato coerente com o texto LITERAL (não a blusa fixa do sheet).
- must_show só o que o texto daquele ato menciona (lugar, pessoas, ação).`,
        },
      ],
    },
    timeoutMs: 90_000,
  });

  if (!result.ok || !result.content) return null;
  try {
    const parsed = parseJsonLoose(result.content);
    if (!parsed) return null;
    const rawActs = Array.isArray(parsed.acts) ? parsed.acts : [];
    const acts: SceneBibleEntry[] = [];
    for (let i = 0; i < rawActs.length; i++) {
      const entry = parseAct(rawActs[i], i);
      if (entry) acts.push(entry);
    }
    if (acts.length === 0) return null;

    const npcRoster: NpcRosterEntry[] = [];
    const rawRoster = Array.isArray(parsed.npc_roster)
      ? parsed.npc_roster
      : Array.isArray(parsed.npcRoster)
        ? parsed.npcRoster
        : [];
    for (const row of rawRoster) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const name = String(r.name ?? "").trim();
      const appearance = String(r.appearance ?? r.look ?? "").trim();
      if (!name || !appearance) continue;
      npcRoster.push({
        name,
        role: String(r.role ?? "npc").trim() || "npc",
        appearance,
      });
    }
    if (npcRoster.length === 0) {
      for (const act of acts) {
        if (act.npcNotes && act.npcNotes.length > 12) {
          npcRoster.push({
            name: "story-npc",
            role: "secondary child",
            appearance: act.npcNotes.slice(0, 220),
          });
          break;
        }
      }
    }

    let environmentAnchor = String(
      parsed.environment_anchor ?? parsed.environmentAnchor ?? "",
    ).trim();
    if (!environmentAnchor) {
      environmentAnchor =
        input.settingPreference?.trim() ||
        acts.find((a) => a.environment)?.environment ||
        "match story setting with stable child-scale props";
    }
    if (input.settingPreference?.trim()) {
      environmentAnchor = `${input.settingPreference.trim()} — keep this place and scale`;
    }

    const cumulativeLocks: string[] = [];
    let hatOn: boolean | null = null;
    let backpackOn: boolean | null = null;
    let companionIn: boolean | null = null;
    let lockedOutfit: string | null = null;
    let schoolDayOutfit: string | null = null;

    function isHomeSleepContext(act: SceneBibleEntry): boolean {
      const blob = `${act.environment} ${act.beat}`.toLowerCase();
      return (
        blob.includes("bed") ||
        blob.includes("cama") ||
        blob.includes("pijama") ||
        blob.includes("pajama") ||
        blob.includes("dorm") ||
        blob.includes("quarto") ||
        blob.includes("bedroom")
      );
    }

    function isSchoolDayContext(act: SceneBibleEntry): boolean {
      const blob = `${act.environment} ${act.beat} ${act.mustShow.join(" ")}`.toLowerCase();
      return (
        blob.includes("school") ||
        blob.includes("escola") ||
        blob.includes("pátio") ||
        blob.includes("patio") ||
        blob.includes("recreio") ||
        blob.includes("recess") ||
        blob.includes("classroom") ||
        blob.includes("sala de aula") ||
        blob.includes("bench") ||
        blob.includes("banco") ||
        blob.includes("lápis") ||
        blob.includes("pencil")
      );
    }

    for (let i = 0; i < acts.length; i++) {
      const act = acts[i];
      if (act.wardrobe.hat != null) hatOn = act.wardrobe.hat;
      if (act.wardrobe.backpack != null) backpackOn = act.wardrobe.backpack;
      if (act.wardrobe.companionInsideBag != null) {
        companionIn = act.wardrobe.companionInsideBag;
      }

      // Dia escolar: uma única roupa/uniforme em TODOS os atos escolares.
      if (isSchoolDayContext(act) && !isHomeSleepContext(act)) {
        if (schoolDayOutfit) {
          act.wardrobe.outfit = schoolDayOutfit;
          act.wardrobe.keepFromPrevious = true;
        } else if (act.wardrobe.outfit) {
          schoolDayOutfit = act.wardrobe.outfit;
          lockedOutfit = act.wardrobe.outfit;
        } else {
          schoolDayOutfit =
            "consistent school-day outfit or uniform (same colors/pieces all school acts)";
          act.wardrobe.outfit = schoolDayOutfit;
          lockedOutfit = schoolDayOutfit;
        }
      } else if (act.wardrobe.keepFromPrevious && lockedOutfit) {
        act.wardrobe.outfit = lockedOutfit;
      } else if (act.wardrobe.outfit) {
        lockedOutfit = act.wardrobe.outfit;
      } else if (lockedOutfit && !isHomeSleepContext(act)) {
        act.wardrobe.outfit = lockedOutfit;
        act.wardrobe.keepFromPrevious = true;
      } else if (!act.wardrobe.outfit) {
        if (isHomeSleepContext(act)) {
          act.wardrobe.outfit = "cozy striped pajamas";
        } else if (isSchoolDayContext(act)) {
          act.wardrobe.outfit =
            "consistent school-day outfit or uniform (same colors/pieces all school acts)";
          schoolDayOutfit = act.wardrobe.outfit;
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

    for (const act of acts) {
      if (!act.environment || act.environment.length < 4) {
        act.environment = environmentAnchor;
      } else {
        act.environment = `${environmentAnchor}; beat detail: ${act.environment}`;
      }
      if (npcRoster.length > 0) {
        const rosterLine = npcRoster
          .map(
            (n) =>
              `${n.name} (${n.role}): ${n.appearance} — MUST NOT resemble protagonist ${input.cast.childName}`,
          )
          .join(" | ");
        act.npcNotes = act.npcNotes
          ? `${rosterLine}. Beat note: ${act.npcNotes}`
          : rosterLine;
        act.mustNotShow = Array.from(
          new Set([
            ...act.mustNotShow,
            `NPC looking like twin/clone of ${input.cast.childName}`,
            "same framing as any previous page",
            "monumental oversized sandcastle unless text demands it",
            `generic rabbit/bear plush replacing companion ${input.cast.friendName}`,
            "characters or locations not present in THIS act's text",
            "extra arms or duplicated limbs",
            "impossible arm bend / back-view torso with front-view hug arm",
          ]),
        );
        act.mustShow = Array.from(
          new Set([
            ...act.mustShow,
            ...npcRoster.map(
              (n) => `${n.name} with locked look: ${n.appearance}`,
            ),
          ]),
        );
      }
    }

    return {
      acts,
      cumulativeLocks,
      npcRoster,
      environmentAnchor,
    };
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
    const npc = act.npcNotes
      ? `NPC NOTES / LOCKED NPC APPEARANCE: ${act.npcNotes}.`
      : "";
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
      bible.environmentAnchor
        ? `ENVIRONMENT ANCHOR (stable scale): ${bible.environmentAnchor}.`
        : "",
      `CAST VISIBLE: ${act.castVisible.join(", ") || "as in text"}`,
      bible.npcRoster.length
        ? `LOCKED NPC ROSTER: ${bible.npcRoster
            .map((n) => `${n.name}=${n.appearance}`)
            .join("; ")}.`
        : "",
      lockLine,
      must,
      mustNot,
      npc,
      "Identity from avatar refs (face, hair, body). Clothing from WARDROBE OUTFIT for this act.",
      "Match the literal story beat of THIS page text only; do not invent contradictory avatar face/hair details.",
      "Companion must match uploaded companion avatar reference — never a generic rabbit/bear substitute.",
      "ANTI-CLONE: other children must not share the protagonist's face/hair/outfit.",
      "UNIQUE FRAME: do not reuse a previous page's composition.",
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
    act.wardrobe.outfit ? `Wardrobe outfit: ${act.wardrobe.outfit}.` : "",
    bible.environmentAnchor
      ? `Environment anchor: ${bible.environmentAnchor}.`
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
