#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import semver from "semver";

const TAG_PREFIX = "v";

const RELEASE_PATH_PATTERNS = [
  /^entrypoints\//,
  /^components\//,
  /^features\//,
  /^hooks\//,
  /^lib\//,
  /^utils\//,
  /^public\//,
  /^assets\//,
  /^wxt\.config\.ts$/,
];

function fail(message) {
  console.error(`\ncheck-version: ${message}\n`);
  process.exit(1);
}

function readPackageVersion() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  return pkg.version;
}

function fetchRemoteTags() {
  try {
    execSync("git fetch --tags origin --quiet", { stdio: "pipe" });
  } catch {
    // Offline or missing remote: fall back to local tags.
  }
}

function latestReleaseTagVersion() {
  const output = execSync('git tag -l "v*" --merged HEAD --sort=-v:refname', {
    encoding: "utf8",
  }).trim();

  for (const tag of output.split("\n").filter(Boolean)) {
    const version = tag.startsWith(TAG_PREFIX)
      ? tag.slice(TAG_PREFIX.length)
      : tag;
    if (semver.valid(version)) {
      return version;
    }
  }

  return null;
}

function stagedFiles() {
  const output = execSync("git diff --cached --name-only", {
    encoding: "utf8",
  }).trim();
  return output ? output.split("\n") : [];
}

function hasReleaseRelevantChanges(files) {
  return files.some((file) =>
    RELEASE_PATH_PATTERNS.some((pattern) => pattern.test(file)),
  );
}

fetchRemoteTags();

const localVersion = readPackageVersion();
if (!semver.valid(localVersion)) {
  fail(`Invalid package.json version: ${localVersion}`);
}

const latestTagVersion = latestReleaseTagVersion();
const staged = stagedFiles();

if (!latestTagVersion) {
  process.exit(0);
}

if (semver.lt(localVersion, latestTagVersion)) {
  fail(
    `package.json version (${localVersion}) is behind latest release tag (${TAG_PREFIX}${latestTagVersion}). Bump with: npm version patch|minor|major --no-git-tag-version`,
  );
}

if (semver.gt(localVersion, latestTagVersion)) {
  process.exit(0);
}

if (hasReleaseRelevantChanges(staged)) {
  fail(
    `Staged extension changes require a version bump above ${TAG_PREFIX}${latestTagVersion}. Current package.json is ${localVersion}. Run: npm version patch --no-git-tag-version`,
  );
}
