#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const OPENAI_MODEL = "gpt-4o-mini";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function gitOutput(command) {
  return execSync(command, { encoding: "utf8" }).trim();
}

function truncate(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}\n\n...[truncated]`;
}

function loadOverride(version) {
  const overridePath = `releases/${version}.md`;
  if (!existsSync(overridePath)) {
    return null;
  }
  return readFileSync(overridePath, "utf8").trim();
}

async function generateWithOpenAI({ version, fromTag, commits, diffStat, diff }) {
  const apiKey = requiredEnv("OPENAI_API_KEY");

  const prompt = [
    "Write public-facing release notes for Motif, a Chrome extension that helps English speakers learn French.",
    "Audience: learners using the extension, not developers.",
    "Only describe changes supported by the commits and diff below.",
    "Use markdown with these sections when applicable: Fixes, Improvements, Notes.",
    "Keep it concise (3-8 bullets total). Do not mention internal refactors unless user-visible.",
    "Do not invent features.",
    "",
    `Release version: ${version}`,
    fromTag ? `Previous release tag: ${fromTag}` : "Previous release tag: none",
    "",
    "Commit subjects:",
    commits || "(none)",
    "",
    "Diff stat:",
    diffStat || "(none)",
    "",
    "Diff excerpt:",
    diff || "(none)",
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You write accurate, friendly release notes for a language-learning browser extension.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errorBody}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI response did not include release notes content.");
  }

  return content;
}

const version = requiredEnv("RELEASE_VERSION");
const fromTag = process.env.FROM_TAG?.trim() ?? "";

const override = loadOverride(version);
if (override) {
  process.stdout.write(`${override}\n`);
  process.exit(0);
}

const range = fromTag ? `${fromTag}..HEAD` : "HEAD";
const commits = gitOutput(`git log ${range} --pretty=format:%s`);
const diffStat = gitOutput(`git diff ${range} --stat`);
const diff = truncate(
  gitOutput(
    `git diff ${range} -- . ` +
      `':(exclude)package-lock.json' ` +
      `':(exclude)*.wasm' ` +
      `':(exclude)*.gz' ` +
      `':(exclude)*.png' ` +
      `':(exclude)*.jpg'`,
  ),
  50_000,
);

const notes = await generateWithOpenAI({
  version,
  fromTag,
  commits,
  diffStat,
  diff,
});

process.stdout.write(`${notes}\n`);
