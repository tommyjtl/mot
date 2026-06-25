#!/usr/bin/env node
/** Download stt-web runtime assets (WASM + worker) from idle-intelligence gh-pages. */

import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STT_DIR = join(ROOT, "public", "stt");
const BASE =
  "https://raw.githubusercontent.com/idle-intelligence/stt-web/gh-pages";

const FILES = [
  "pkg/stt_wasm.js",
  "pkg/stt_wasm_bg.wasm",
  "web/worker.js",
  "web/audio-processor.js",
  "web/stt-client.js",
];

async function download(relativePath) {
  const destination = join(STT_DIR, relativePath.replace(/^web\//, ""));
  if (relativePath.startsWith("pkg/")) {
    // keep pkg/ subfolder
  }
  const outPath =
    relativePath.startsWith("pkg/")
      ? join(STT_DIR, relativePath)
      : join(STT_DIR, relativePath.replace(/^web\//, ""));

  mkdirSync(dirname(outPath), { recursive: true });

  if (existsSync(outPath)) {
    console.log(`skip  ${relativePath}`);
    return;
  }

  const url = `${BASE}/${relativePath}`;
  console.log(`fetch ${relativePath}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }

  await pipeline(response.body, createWriteStream(outPath));
  console.log(`saved ${relativePath}`);
}

mkdirSync(STT_DIR, { recursive: true });

for (const file of FILES) {
  await download(file);
}

console.log("STT runtime assets ready in public/stt/");
