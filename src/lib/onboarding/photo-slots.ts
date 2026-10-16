export type PhotoSubject = "child" | "friend";

export type PhotoSlotDef = {
  id: string;
  group: "face" | "body";
  orientation:
    | "front"
    | "three_quarter_right"
    | "profile_right"
    | "three_quarter_left"
    | "profile_left"
    | "back";
  labelChild: string;
  labelFriend: string;
  tipChild: string;
  tipFriend: string;
  /** Simple CSS silhouette hint */
  silhouette: "front" | "angle-r" | "side-r" | "angle-l" | "side-l" | "back";
};

const ORIENTATIONS: Omit<
  PhotoSlotDef,
  "id" | "group" | "labelChild" | "labelFriend" | "tipChild" | "tipFriend"
>[] = [
  {
    orientation: "front",
    silhouette: "front",
  },
  {
    orientation: "three_quarter_right",
    silhouette: "angle-r",
  },
  {
    orientation: "profile_right",
    silhouette: "side-r",
  },
  {
    orientation: "three_quarter_left",
    silhouette: "angle-l",
  },
  {
    orientation: "profile_left",
    silhouette: "side-l",
  },
  {
    orientation: "back",
    silhouette: "back",
  },
];

const FACE_COPY: Record<
  PhotoSlotDef["orientation"],
  { labelChild: string; tipChild: string; labelFriend: string; tipFriend: string }
> = {
  front: {
    labelChild: "Rosto — frente",
    tipChild: "Olhando para a câmera, rosto bem iluminado",
    labelFriend: "Detalhe — frente",
    tipFriend: "Pet/brinquedo de frente, bem nítido",
  },
  three_quarter_right: {
    labelChild: "Rosto — ¾ direita",
    tipChild: "Levemente virado para a direita",
    labelFriend: "¾ direita",
    tipFriend: "Gire um pouco para a direita",
  },
  profile_right: {
    labelChild: "Rosto — perfil direita",
    tipChild: "Perfil completo do lado direito",
    labelFriend: "Perfil direita",
    tipFriend: "Perfil direito do pet/brinquedo",
  },
  three_quarter_left: {
    labelChild: "Rosto — ¾ esquerda",
    tipChild: "Levemente virado para a esquerda",
    labelFriend: "¾ esquerda",
    tipFriend: "Gire um pouco para a esquerda",
  },
  profile_left: {
    labelChild: "Rosto — perfil esquerda",
    tipChild: "Perfil completo do lado esquerdo",
    labelFriend: "Perfil esquerda",
    tipFriend: "Perfil esquerdo do pet/brinquedo",
  },
  back: {
    labelChild: "Rosto — costas / nuca",
    tipChild: "De costas, mostrando cabelo e nuca",
    labelFriend: "Costas",
    tipFriend: "Vista de trás",
  },
};

const BODY_COPY: Record<
  PhotoSlotDef["orientation"],
  { labelChild: string; tipChild: string; labelFriend: string; tipFriend: string }
> = {
  front: {
    labelChild: "Corpo — frente",
    tipChild: "Corpo inteiro de frente",
    labelFriend: "Corpo inteiro — frente",
    tipFriend: "Pet/brinquedo inteiro de frente",
  },
  three_quarter_right: {
    labelChild: "Corpo — ¾ direita",
    tipChild: "Corpo inteiro, ¾ à direita",
    labelFriend: "Corpo — ¾ direita",
    tipFriend: "Inteiro, levemente à direita",
  },
  profile_right: {
    labelChild: "Corpo — perfil direita",
    tipChild: "Corpo inteiro de perfil direito",
    labelFriend: "Corpo — perfil direita",
    tipFriend: "Inteiro de perfil direito",
  },
  three_quarter_left: {
    labelChild: "Corpo — ¾ esquerda",
    tipChild: "Corpo inteiro, ¾ à esquerda",
    labelFriend: "Corpo — ¾ esquerda",
    tipFriend: "Inteiro, levemente à esquerda",
  },
  profile_left: {
    labelChild: "Corpo — perfil esquerda",
    tipChild: "Corpo inteiro de perfil esquerdo",
    labelFriend: "Corpo — perfil esquerda",
    tipFriend: "Inteiro de perfil esquerdo",
  },
  back: {
    labelChild: "Corpo — costas",
    tipChild: "Corpo inteiro de costas",
    labelFriend: "Corpo — costas",
    tipFriend: "Inteiro de costas",
  },
};

function buildSlots(group: "face" | "body"): PhotoSlotDef[] {
  const copy = group === "face" ? FACE_COPY : BODY_COPY;
  return ORIENTATIONS.map((o) => ({
    id: `${group}-${o.orientation}`,
    group,
    orientation: o.orientation,
    silhouette: o.silhouette,
    ...copy[o.orientation],
  }));
}

export const PHOTO_SLOTS: PhotoSlotDef[] = [
  ...buildSlots("face"),
  ...buildSlots("body"),
];

export const REQUIRED_PHOTO_COUNT = PHOTO_SLOTS.length; // 12

export function slotLabel(slot: PhotoSlotDef, subject: PhotoSubject): string {
  return subject === "child" ? slot.labelChild : slot.labelFriend;
}

export function slotTip(slot: PhotoSlotDef, subject: PhotoSubject): string {
  return subject === "child" ? slot.tipChild : slot.tipFriend;
}

export function missingSlotIds(
  filled: Record<string, unknown>,
): string[] {
  return PHOTO_SLOTS.filter((s) => !filled[s.id]).map((s) => s.id);
}
