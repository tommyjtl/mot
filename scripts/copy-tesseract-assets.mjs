import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tesseractDist = join(root, "node_modules", "tesseract.js", "dist");
const tesseractCoreDir = join(root, "node_modules", "tesseract.js-core");
const targetDir = join(root, "public", "tesseract");
const tessdataDir = join(targetDir, "tessdata");

const CORE_FILES = [
  "tesseract-core.wasm.js",
  "tesseract-core-simd.wasm.js",
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-relaxedsimd.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
];

const FRA_TRAINEDDATA_URL =
  "https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best_int/fra.traineddata.gz";

async function downloadFrenchModel() {
  const destination = join(tessdataDir, "fra.traineddata.gz");
  if (existsSync(destination)) {
    console.log("[mot] French OCR model already present");
    return;
  }

  console.log("[mot] Downloading French OCR model (fra.traineddata.gz)…");
  const response = await fetch(FRA_TRAINEDDATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to download French OCR model: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  mkdirSync(tessdataDir, { recursive: true });
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(destination, buffer),
  );
  console.log(
    `[mot] Saved French OCR model (${(buffer.length / (1024 * 1024)).toFixed(1)} MB)`,
  );
}

if (!existsSync(tesseractDist) || !existsSync(tesseractCoreDir)) {
  console.warn("[mot] tesseract.js not installed; skip tesseract asset copy");
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });
mkdirSync(tessdataDir, { recursive: true });

copyFileSync(
  join(tesseractDist, "worker.min.js"),
  join(targetDir, "worker.min.js"),
);

for (const file of CORE_FILES) {
  const source = join(tesseractCoreDir, file);
  if (!existsSync(source)) {
    console.warn(`[mot] Missing tesseract core file: ${file}`);
    continue;
  }
  cpSync(source, join(targetDir, file), { force: true });
}

console.log("[mot] Copied Tesseract.js worker and core assets to public/tesseract/");

await downloadFrenchModel();
