/**
 * Corta folhas de turnaround 3D (Pixar) em 12 guias por gênero.
 * Saída: public/onboarding/guides/{girl,boy,neutral}/*.png
 */
import sharp from "sharp";
import { mkdirSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const ref = (...p) => resolve(root, "public/onboarding/reference", ...p);

const FACE_ORDER = [
  "face-front",
  "face-three_quarter_left",
  "face-three_quarter_right",
  "face-profile_right",
  "face-profile_left",
  "face-back",
];

const BODY_GIRL = [
  { slot: "body-profile_right", col: 0, row: 0 },
  { slot: "body-three_quarter_right", col: 1, row: 0 },
  { slot: "body-front", col: 0, row: 1 },
  { slot: "body-three_quarter_left", col: 1, row: 1 },
  { slot: "body-profile_left", col: 2, row: 1 },
];

const BODY_BOY = [
  { slot: "body-profile_right", col: 0, row: 0 },
  { slot: "body-three_quarter_right", col: 1, row: 0 },
  { slot: "body-back", col: 2, row: 0 },
  { slot: "body-front", col: 0, row: 1 },
  { slot: "body-three_quarter_left", col: 1, row: 1 },
  { slot: "body-profile_left", col: 2, row: 1 },
];

async function cropFaceSheet(input, outDirs) {
  const meta = await sharp(input).metadata();
  const cols = 2;
  const rows = 3;
  const cellW = Math.floor(meta.width / cols);
  const cellH = Math.floor(meta.height / rows);
  const topTrim = Math.round(cellH * 0.14);

  for (let i = 0; i < FACE_ORDER.length; i++) {
    const slot = FACE_ORDER[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const buf = await sharp(input)
      .extract({
        left: col * cellW,
        top: row * cellH + topTrim,
        width: cellW,
        height: cellH - topTrim,
      })
      .resize(640, 800, {
        fit: "cover",
        position: "centre",
      })
      .png({ compressionLevel: 8 })
      .toBuffer();
    for (const dir of outDirs) {
      mkdirSync(dir, { recursive: true });
      await sharp(buf).toFile(resolve(dir, `${slot}.png`));
    }
    console.log("face", slot);
  }
}

async function cropBodySheet(input, map, outDirs, opts = {}) {
  const meta = await sharp(input).metadata();
  const cols = 3;
  const rows = 2;
  const cellW = Math.floor(meta.width / cols);
  const cellH = Math.floor(meta.height / rows);
  const topTrim = Math.round(cellH * (opts.labelTrim ?? 0.1));

  for (const { slot, col, row } of map) {
    const buf = await sharp(input)
      .extract({
        left: col * cellW,
        top: row * cellH + topTrim,
        width: cellW,
        height: cellH - topTrim,
      })
      .resize(640, 900, { fit: "cover", position: "centre" })
      .png({ compressionLevel: 8 })
      .toBuffer();
    for (const dir of outDirs) {
      mkdirSync(dir, { recursive: true });
      await sharp(buf).toFile(resolve(dir, `${slot}.png`));
    }
    console.log("body", slot);
  }
}

async function writeBodyBackFromFile(input, outDirs) {
  const buf = await sharp(input)
    .resize(640, 900, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 8 })
    .toBuffer();
  for (const dir of outDirs) {
    mkdirSync(dir, { recursive: true });
    await sharp(buf).toFile(resolve(dir, "body-back.png"));
  }
  console.log("body-back from", input);
}

const girlDir = resolve(root, "public/onboarding/guides/girl");
const boyDir = resolve(root, "public/onboarding/guides/boy");
const neutralDir = resolve(root, "public/onboarding/guides/neutral");

await cropFaceSheet(ref("face-sheet-girl.png"), [girlDir]);
await cropBodySheet(ref("body-sheet-girl.png"), BODY_GIRL, [girlDir]);
await writeBodyBackFromFile(ref("body-back-girl.jpg"), [girlDir]);

await cropFaceSheet(ref("face-sheet-boy.jpg"), [boyDir, neutralDir]);
await cropBodySheet(ref("body-sheet-boy.jpg"), BODY_BOY, [boyDir, neutralDir]);

/**
 * Folhas Pixar: células "left" de ¾ (face) e corpo (¾ + perfil) vêm viradas
 * para a direita do viewer. Espelhar para bater o label viewer-facing:
 * esquerda = olhando à esquerda do viewer.
 * face-profile_left já vem correto na folha — não flopar.
 */
const FLOP_AFTER_CROP = [
  "face-three_quarter_left.png",
  "body-three_quarter_left.png",
  "body-profile_left.png",
];

async function flopGuides(dirs) {
  for (const dir of dirs) {
    for (const file of FLOP_AFTER_CROP) {
      const path = resolve(dir, file);
      const buf = await sharp(path).flop().png({ compressionLevel: 8 }).toBuffer();
      await sharp(buf).toFile(path);
      console.log("flop", dir.split("/").pop(), file);
    }
  }
}

await flopGuides([girlDir, boyDir, neutralDir]);

console.log("done — all guides are 3D sheet crops (no SVG)");
