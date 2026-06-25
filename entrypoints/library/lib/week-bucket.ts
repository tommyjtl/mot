import type { VocabEntry } from "@/utils/vocab/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export type WeekBucket = {
  weekStart: number;
  entries: VocabEntry[];
};

/** Monday 00:00:00 local time for the week containing `timestamp`. */
export function getWeekStartMs(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function bucketEntriesByWeek(entries: VocabEntry[]): WeekBucket[] {
  const byWeek = new Map<number, VocabEntry[]>();

  for (const entry of entries) {
    const weekStart = getWeekStartMs(entry.createdAt);
    const bucket = byWeek.get(weekStart);
    if (bucket) {
      bucket.push(entry);
    } else {
      byWeek.set(weekStart, [entry]);
    }
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => b - a)
    .map(([weekStart, weekEntries]) => ({
      weekStart,
      entries: weekEntries,
    }));
}

function formatShortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatWeekRange(weekStart: number): string {
  const rangeEnd = weekStart + MS_PER_WEEK - MS_PER_DAY;
  const start = new Date(weekStart);
  const end = new Date(rangeEnd);
  const yearSuffix =
    start.getFullYear() === end.getFullYear()
      ? `, ${start.getFullYear()}`
      : "";

  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `${formatShortDate(weekStart)} – ${end.getDate()}${yearSuffix}`;
  }

  const endLabel = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: start.getFullYear() === end.getFullYear() ? undefined : "numeric",
  });

  return `${formatShortDate(weekStart)} – ${endLabel}`;
}

export function formatWeekLabel(
  weekStart: number,
  referenceNow = Date.now(),
): string {
  const thisWeekStart = getWeekStartMs(referenceNow);

  if (weekStart === thisWeekStart) {
    return "This week";
  }

  if (weekStart === thisWeekStart - MS_PER_WEEK) {
    return "Last week";
  }

  return formatWeekRange(weekStart);
}
