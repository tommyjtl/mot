#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import semver from "semver";

const TAG_PREFIX = "v";

function readPackageVersion() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  return pkg.version;
}

function latestMergedReleaseTag() {
  const output = execSync('git tag -l "v*" --merged HEAD --sort=-v:refname', {
    encoding: "utf8",
  }).trim();

  for (const tag of output.split("\n").filter(Boolean)) {
    const version = tag.startsWith(TAG_PREFIX)
      ? tag.slice(TAG_PREFIX.length)
      : tag;
    if (semver.valid(version)) {
      return { tag, version };
    }
  }

  return null;
}

function tagExists(tagName) {
  try {
    execSync(`git rev-parse --verify "refs/tags/${tagName}"`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const version = readPackageVersion();
const latest = latestMergedReleaseTag();
const releaseTag = `${TAG_PREFIX}${version}`;

const versionIsNew = latest ? semver.gt(version, latest.version) : semver.valid(version);
const shouldRelease = Boolean(versionIsNew && !tagExists(releaseTag));

const outputs = {
  version,
  from_tag: latest?.tag ?? "",
  should_release: shouldRelease ? "true" : "false",
};

if (process.env.GITHUB_OUTPUT) {
  for (const [key, value] of Object.entries(outputs)) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
} else {
  console.log(JSON.stringify(outputs, null, 2));
}
