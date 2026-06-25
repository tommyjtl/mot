#!/usr/bin/env node
/**
 * Inspect and clean Motif dev browser storage.
 *
 * Usage:
 *   node scripts/dev-storage.mjs              # status report (default)
 *   node scripts/dev-storage.mjs --clean-tmp  # legacy tmp-web-ext profiles in /tmp
 *   node scripts/dev-storage.mjs --clean-profile  # remove .wxt/chrome-data
 *   node scripts/dev-storage.mjs --clean-all  # tmp + profile
 *
 * Options: --dry-run, --force (skip "wxt dev is running" guard)
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME_DATA = join(ROOT, ".wxt", "chrome-data");
const CACHE_STORAGE = join(
  CHROME_DATA,
  "Default",
  "Service Worker",
  "CacheStorage",
);
const MODELS_DIR = join(ROOT, "models", "supertonic-3");
const TMP_PREFIX = "tmp-web-ext--";

const MOTIF_CACHE_NAMES = ["mot-supertonic-v3", "mot-stt-model-v1"];

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const cleanTmp = args.has("--clean-tmp");
const cleanProfile = args.has("--clean-profile");
const cleanAll = args.has("--clean-all");
const showHelp = args.has("--help") || args.has("-h");

function printHelp() {
  console.log(`Motif dev storage

Usage:
  npm run dev:storage                     Report disk usage (default)
  npm run dev:clean-tmp                   Remove stale tmp-web-ext profiles
  npm run dev:clean-profile               Remove .wxt/chrome-data (model cache + profile)
  npm run dev:storage -- --clean-all      Remove tmp profiles and chrome-data

Options:
  --dry-run    Show what would be deleted without deleting
  --force      Run even if WXT dev appears to be running
  --help       Show this help

Notes:
  - Model caches (~1 GB TTS + STT) live in .wxt/chrome-data, not in /tmp.
  - dev:clean-tmp only removes legacy tmp-web-ext--* folders (usually a few MB).
  - dev:clean-profile is equivalent to: rm -rf .wxt/chrome-data
  - Stop npm run dev and close the dev browser before cleaning.`);
}

function isWxtDevRunning() {
  try {
    const output = execSync("pgrep -fl wxt 2>/dev/null || true", {
      encoding: "utf8",
    }).trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

function dirSizeKb(path) {
  if (!existsSync(path)) {
    return 0;
  }

  try {
    return Number(
      execSync(`du -sk ${JSON.stringify(path)}`, { encoding: "utf8" }).split(
        /\s/,
      )[0],
    );
  } catch {
    return 0;
  }
}

function formatKb(kb) {
  if (kb >= 1024 * 1024) {
    return `${(kb / 1024 / 1024).toFixed(1)} GB`;
  }
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  if (kb <= 0) {
    return "0 KB";
  }
  return `${kb} KB`;
}

function tempRoots() {
  const roots = new Set();

  if (process.env.TMPDIR) {
    roots.add(resolve(process.env.TMPDIR));
  }

  roots.add("/tmp");

  if (process.platform === "darwin" && existsSync("/var/folders")) {
    for (const bucket of readdirSync("/var/folders")) {
      const bucketPath = join("/var/folders", bucket);
      let subs;
      try {
        subs = readdirSync(bucketPath);
      } catch {
        continue;
      }

      for (const sub of subs) {
        const tPath = join(bucketPath, sub, "T");
        if (existsSync(tPath)) {
          roots.add(resolve(tPath));
        }
      }
    }
  }

  return [...roots];
}

function findTmpWebExtDirs() {
  const seen = new Set();
  const found = [];

  for (const root of tempRoots()) {
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith(TMP_PREFIX)) {
        continue;
      }

      const fullPath = resolve(join(root, entry.name));
      if (seen.has(fullPath)) {
        continue;
      }

      seen.add(fullPath);
      found.push(fullPath);
    }
  }

  return found.sort();
}

function findMotifModelCaches() {
  if (!existsSync(CACHE_STORAGE)) {
    return [];
  }

  const caches = [];

  for (const bucketId of readdirSync(CACHE_STORAGE)) {
    const bucketPath = join(CACHE_STORAGE, bucketId);
    const indexPath = join(bucketPath, "index.txt");
    if (!existsSync(indexPath)) {
      continue;
    }

    const indexBytes = readFileSync(indexPath);
    const indexText = indexBytes.toString("latin1");
    if (!indexText.includes("chrome-extension://")) {
      continue;
    }

    for (const name of MOTIF_CACHE_NAMES) {
      // Chrome CacheStorage index is protobuf; cache name is followed by \x12$<uuid>.
      const match = indexText.match(
        new RegExp(`${name.replace(/-/g, "\\-")}\x12\\$([0-9a-f-]{36})`),
      );
      if (!match) {
        continue;
      }

      const cacheDir = join(bucketPath, match[1]);
      if (!existsSync(cacheDir)) {
        continue;
      }

      caches.push({
        name,
        path: cacheDir,
        sizeKb: dirSizeKb(cacheDir),
      });
    }
  }

  return caches;
}

function printStatus() {
  console.log("[mot] Dev storage report\n");

  const chromeKb = dirSizeKb(CHROME_DATA);
  const modelsKb = dirSizeKb(MODELS_DIR);
  const tmpDirs = findTmpWebExtDirs();
  const tmpKb = tmpDirs.reduce((total, dir) => total + dirSizeKb(dir), 0);
  const motifCaches = findMotifModelCaches();
  const motifCacheKb = motifCaches.reduce((total, entry) => total + entry.sizeKb, 0);

  console.log(`  .wxt/chrome-data          ${formatKb(chromeKb)}  (persistent WXT dev profile)`);
  console.log(`    └ model caches          ${formatKb(motifCacheKb)}  (Cache API in Service Worker storage)`);
  for (const cache of motifCaches) {
    console.log(`        ${cache.name.padEnd(22)} ${formatKb(cache.sizeKb)}`);
  }
  if (motifCaches.length === 0 && existsSync(CHROME_DATA)) {
    console.log("        (no motif model caches found yet)");
  } else if (!existsSync(CHROME_DATA)) {
    console.log("        (profile not created — run npm run dev first)");
  }

  console.log(`  models/supertonic-3       ${formatKb(modelsKb)}  (local dev server via models:serve)`);
  console.log(`  tmp-web-ext profiles      ${formatKb(tmpKb)}  (${tmpDirs.length} in /tmp — legacy, not used by current dev)`);

  console.log("\nCommands:");
  console.log("  npm run dev:storage              this report");
  console.log("  npm run dev:clean-tmp            remove tmp-web-ext profiles only");
  console.log("  npm run dev:clean-profile        remove .wxt/chrome-data (clears ~1 GB model cache)");
  console.log("  npm run dev:storage -- --clean-all   tmp + profile");
}

function assertSafeToClean() {
  if (force || dryRun) {
    return;
  }

  if (isWxtDevRunning()) {
    console.error("[mot] WXT dev appears to be running.");
    console.error("[mot] Stop `npm run dev` and close the dev browser first.");
    console.error("[mot] To override: add --force");
    process.exit(1);
  }
}

function removeTmpProfiles() {
  const profiles = findTmpWebExtDirs();

  if (profiles.length === 0) {
    console.log("[mot] No stale tmp-web-ext profiles found.");
    return 0;
  }

  let totalKb = 0;
  console.log(
    `[mot] ${dryRun ? "Would remove" : "Removing"} ${profiles.length} tmp-web-ext profile(s):`,
  );

  for (const profile of profiles) {
    const kb = dirSizeKb(profile);
    totalKb += kb;
    console.log(`  - ${profile} (${formatKb(kb)})`);

    if (!dryRun) {
      rmSync(profile, { recursive: true, force: true });
    }
  }

  console.log(`[mot] tmp-web-ext total: ${formatKb(totalKb)}`);
  return totalKb;
}

function removeChromeProfile() {
  if (!existsSync(CHROME_DATA)) {
    console.log("[mot] No .wxt/chrome-data profile found.");
    return 0;
  }

  const kb = dirSizeKb(CHROME_DATA);
  const motifCaches = findMotifModelCaches();
  const motifKb = motifCaches.reduce((total, entry) => total + entry.sizeKb, 0);

  console.log(
    `[mot] ${dryRun ? "Would remove" : "Removing"} dev Chrome profile:`,
  );
  console.log(`  ${CHROME_DATA} (${formatKb(kb)})`);
  if (motifKb > 0) {
    console.log(`  includes ~${formatKb(motifKb)} of cached TTS/STT models`);
  }

  if (!dryRun) {
    rmSync(CHROME_DATA, { recursive: true, force: true });
  }

  console.log(
    "[mot] Next `npm run dev` creates a fresh profile; models re-download on warm-up.",
  );
  return kb;
}

function main() {
  if (showHelp) {
    printHelp();
    return;
  }

  const wantsClean = cleanTmp || cleanProfile || cleanAll;

  if (!wantsClean) {
    printStatus();
    return;
  }

  assertSafeToClean();

  if (cleanTmp || cleanAll) {
    removeTmpProfiles();
  }

  if (cleanProfile || cleanAll) {
    if (cleanTmp || cleanAll) {
      console.log("");
    }
    removeChromeProfile();
  }

  if (dryRun) {
    console.log("[mot] Dry run only. Re-run without --dry-run to delete.");
  } else {
    console.log("[mot] Done.");
  }
}

main();
