import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "node_modules", "onnxruntime-web", "dist");
const targetDir = join(root, "public", "ort");

const REQUIRED_FILES = [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
];

if (!existsSync(sourceDir)) {
  console.warn("[mot] onnxruntime-web dist not found; skip wasm copy");
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });

for (const file of REQUIRED_FILES) {
  cpSync(join(sourceDir, file), join(targetDir, file), { force: true });
}

console.log("[mot] Copied ONNX Runtime Web wasm assets to public/ort/");
