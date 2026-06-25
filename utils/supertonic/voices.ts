export const VOICE_OPTIONS = [
  {
    id: "M1",
    label: "Male 1 (M1) — Lively, upbeat",
    group: "male",
  },
  {
    id: "M2",
    label: "Male 2 (M2) — Deep, calm",
    group: "male",
  },
  {
    id: "M3",
    label: "Male 3 (M3) — Authoritative",
    group: "male",
  },
  {
    id: "M4",
    label: "Male 4 (M4) — Gentle, friendly",
    group: "male",
  },
  {
    id: "M5",
    label: "Male 5 (M5) — Warm, soothing",
    group: "male",
  },
  {
    id: "F1",
    label: "Female 1 (F1) — Calm, composed",
    group: "female",
  },
  {
    id: "F2",
    label: "Female 2 (F2) — Bright, cheerful",
    group: "female",
  },
  {
    id: "F3",
    label: "Female 3 (F3) — Professional announcer",
    group: "female",
  },
  {
    id: "F4",
    label: "Female 4 (F4) — Crisp, confident",
    group: "female",
  },
  {
    id: "F5",
    label: "Female 5 (F5) — Kind, gentle",
    group: "female",
  },
] as const;

export type Voice = (typeof VOICE_OPTIONS)[number]["id"];

export const DEFAULT_VOICE: Voice = "F1";

const voiceLabels = new Map(VOICE_OPTIONS.map((option) => [option.id, option.label]));

export function isVoice(value: unknown): value is Voice {
  return typeof value === "string" && voiceLabels.has(value as Voice);
}

export function voiceLabel(voice: Voice): string {
  return voiceLabels.get(voice) ?? voice;
}

export const MALE_VOICE_OPTIONS = VOICE_OPTIONS.filter(
  (option) => option.group === "male",
);

export const FEMALE_VOICE_OPTIONS = VOICE_OPTIONS.filter(
  (option) => option.group === "female",
);
