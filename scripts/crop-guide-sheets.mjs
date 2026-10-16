/**
 * Corta as folhas de referência (rosto 2×3, corpo 3×2) em guias por slot.
 * Usa sharp. Saída: public/onboarding/guides/{girl,neutral}/*.png
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const faceSheet = resolve(root, "public/onboarding/reference/face-sheet-girl.png");
const bodySheet = resolve(root, "public/onboarding/reference/body-sheet-girl.png");

const FACE_ORDER = [
  // row-major 2 cols × 3 rows
  "face-front",
  "face-three_quarter_left", // top-right: head turned to her left
  "face-three_quarter_right", // mid-left
  "face-profile_right", // mid-right
  "face-profile_left", // bottom-left
  "face-back", // bottom-right
];

// Body sheet is 3 cols × 2 rows — missing true back; top-right is eyes-closed ¾
const BODY_MAP = [
  { slot: "body-profile_right", col: 0, row: 0 },
  { slot: "body-three_quarter_right", col: 1, row: 0 },
  // col 2 row 0 = eyes closed — skip for now (body-back generated separately)
  { slot: "body-front", col: 0, row: 1 },
  { slot: "body-three_quarter_left", col: 1, row: 1 },
  { slot: "body-profile_left", col: 2, row: 1 },
];

async function cropGrid(input, cols, rows, order, outDirs, labelTrim = 0.12) {
  const meta = await sharp(input).metadata();
  const w = meta.width;
  const h = meta.height;
  const cellW = Math.floor(w / cols);
  const cellH = Math.floor(h / rows);
  const topTrim = Math.round(cellH * labelTrim);

  for (let i = 0; i < order.length; i++) {
    const slot = order[i];
    if (!slot) continue;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const left = col * cellW;
    const top = row * cellH + topTrim;
    const height = cellH - topTrim;
    const buf = await sharp(input)
      .extract({ left, top, width: cellW, height })
      .resize(512, 640, { fit: "contain", background: { r: 245, g: 240, b: 232, alpha: 1 } })
      .png({ compressionLevel: 8 })
      .toBuffer();
    for (const dir of outDirs) {
      mkdirSync(dir, { recursive: true });
      await sharp(buf).toFile(resolve(dir, `${slot}.png`));
    }
    console.log("wrote", slot, cellW, height);
  }
}

async function cropBody(outDirs) {
  const meta = await sharp(bodySheet).metadata();
  const w = meta.width;
  const h = meta.height;
  const cols = 3;
  const rows = 2;
  const cellW = Math.floor(w / cols);
  const cellH = Math.floor(h / rows);
  const topTrim = Math.round(cellH * 0.1);

  for (const { slot, col, row } of BODY_MAP) {
    const left = col * cellW;
    const top = row * cellH + topTrim;
    const height = cellH - topTrim;
    const buf = await sharp(bodySheet)
      .extract({ left, top, width: cellW, height })
      .resize(512, 720, { fit: "contain", background: { r: 245, g: 240, b: 232, alpha: 1 } })
      .png({ compressionLevel: 8 })
      .toBuffer();
    for (const dir of outDirs) {
      mkdirSync(dir, { recursive: true });
      await sharp(buf).toFile(resolve(dir, `${slot}.png`));
    }
    console.log("wrote", slot);
  }

  // Provisional body-back: use eyes-closed panel as last resort until generated
  const left = 2 * cellW;
  const top = 0 + topTrim;
  const height = cellH - topTrim;
  const provisional = await sharp(bodySheet)
    .extract({ left, top, width: cellW, height })
    .resize(512, 720, { fit: "contain", background: { r: 245, g: 240, b: 232, alpha: 1 } })
    .png()
    .toBuffer();
  for (const dir of outDirs) {
    await sharp(provisional).toFile(resolve(dir, "body-back.png"));
  }
  console.log("wrote body-back (provisional from sheet)");
}

const girlDir = resolve(root, "public/onboarding/guides/girl");
const neutralDir = resolve(root, "public/onboarding/guides/neutral");

await cropGrid(faceSheet, 2, 3, FACE_ORDER, [girlDir, neutralDir]);
await cropBody([girlDir, neutralDir]);
console.log("done");
