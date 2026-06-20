import { execSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const PROFILE_PREFIX = "tmp-web-ext--";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");

function isWebExtTmpDir(name) {
  return name.startsWith(PROFILE_PREFIX);
}

function tempRoots() {
  const roots = new Set();

  if (process.env.TMPDIR) {
    roots.add(process.env.TMPDIR);
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
          roots.add(tPath);
        }
      }
    }
  }

  return [...roots];
}

function findWebExtTmpDirs() {
  const found = [];

  for (const root of tempRoots()) {
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && isWebExtTmpDir(entry.name)) {
        found.push(join(root, entry.name));
      }
    }
  }

  return found.sort();
}

function dirSizeHuman(path) {
  try {
    const kb = Number(execSync(`du -sk ${JSON.stringify(path)}`, { encoding: "utf8" }).split(/\s/)[0]);
    if (kb >= 1024 * 1024) {
      return `${(kb / 1024 / 1024).toFixed(1)} GB`;
    }
    if (kb >= 1024) {
      return `${(kb / 1024).toFixed(1)} MB`;
    }
    return `${kb} KB`;
  } catch {
    return "unknown size";
  }
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

function formatTotalBytes(kbTotal) {
  if (kbTotal >= 1024 * 1024) {
    return `${(kbTotal / 1024 / 1024).toFixed(1)} GB`;
  }
  if (kbTotal >= 1024) {
    return `${(kbTotal / 1024).toFixed(1)} MB`;
  }
  return `${kbTotal} KB`;
}

const profiles = findWebExtTmpDirs();

if (profiles.length === 0) {
  console.log("[mot] No stale tmp-web-ext profiles found.");
  process.exit(0);
}

if (!dryRun && !force && isWxtDevRunning()) {
  console.error("[mot] WXT dev appears to be running.");
  console.error("[mot] Stop `npm run dev` and close the dev browser first, then rerun.");
  console.error("[mot] To override: npm run dev:clean-tmp -- --force");
  process.exit(1);
}

let totalKb = 0;

console.log(
  `[mot] ${dryRun ? "Would remove" : "Removing"} ${profiles.length} tmp-web-ext profile(s):`,
);

for (const profile of profiles) {
  const size = dirSizeHuman(profile);
  try {
    const kb = Number(
      execSync(`du -sk ${JSON.stringify(profile)}`, { encoding: "utf8" }).split(/\s/)[0],
    );
    totalKb += kb;
  } catch {
    // Ignore size errors for individual dirs.
  }

  console.log(`  - ${profile} (${size})`);

  if (!dryRun) {
    rmSync(profile, { recursive: true, force: true });
  }
}

console.log(`[mot] Total: ${formatTotalBytes(totalKb)}`);

if (dryRun) {
  console.log("[mot] Dry run only. Re-run without --dry-run to delete.");
} else {
  console.log("[mot] Done.");
}
