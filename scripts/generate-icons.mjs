#!/usr/bin/env node
/**
 * Resize public/icon-128.png into the other WXT extension icon sizes.
 *
 * Usage:
 *   node scripts/generate-icons.mjs
 *   node scripts/generate-icons.mjs --source /path/to/icon.png
 *
 * Requires macOS `sips` (Scriptable Image Processing System).
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE = join(ROOT, "public", "icon-128.png");
const OUT_DIR = join(ROOT, "public");
const SIZES = [16, 24, 48, 96];

function parseSourceArg() {
  const idx = process.argv.indexOf("--source");
  if (idx === -1) {
    return DEFAULT_SOURCE;
  }

  const value = process.argv[idx + 1];
  if (!value) {
    throw new Error("Missing path after --source");
  }

  return resolve(value);
}

function ensureSips() {
  try {
    execSync("command -v sips", { stdio: "ignore" });
  } catch {
    throw new Error(
      "sips not found. On macOS, edit public/icon-128.png then run this script again.",
    );
  }
}

function generateIcon(source, size) {
  const destination = join(OUT_DIR, `icon-${size}.png`);
  execSync(
    `sips -s format png -z ${size} ${size} ${JSON.stringify(source)} --out ${JSON.stringify(destination)}`,
    { stdio: "inherit" },
  );
}

const source = parseSourceArg();

if (!existsSync(source)) {
  throw new Error(`Source icon not found: ${source}`);
}

ensureSips();

console.log(`Generating icons from ${source}`);
for (const size of SIZES) {
  generateIcon(source, size);
  console.log(`  icon-${size}.png`);
}

console.log("Done. Rebuild or reload the extension to pick up changes.");
