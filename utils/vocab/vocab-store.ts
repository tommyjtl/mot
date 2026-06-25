import { browser } from "wxt/browser";
import { normalizeVocabKey } from "./normalize";
import type {
  VocabContextInput,
  VocabCreateInput,
  VocabEntry,
  VocabExport,
  VocabStore,
} from "./types";
import { VOCAB_SCHEMA_VERSION } from "./types";

const STORAGE_KEY = "motVocab";

function createEmptyStore(): VocabStore {
  return {
    schemaVersion: VOCAB_SCHEMA_VERSION,
    entries: {},
  };
}

function createContextId(): string {
  return crypto.randomUUID();
}

function createEntryId(): string {
  return crypto.randomUUID();
}

function createContext(input: VocabContextInput) {
  return {
    id: createContextId(),
    sentence: input.sentence,
    url: input.url,
    pageTitle: input.pageTitle,
    addedAt: Date.now(),
  };
}

export async function loadVocabStore(): Promise<VocabStore> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY] as Partial<VocabStore> | undefined;

  if (!value || typeof value !== "object") {
    return createEmptyStore();
  }

  if (
    value.schemaVersion !== VOCAB_SCHEMA_VERSION ||
    !value.entries ||
    typeof value.entries !== "object"
  ) {
    return createEmptyStore();
  }

  return {
    schemaVersion: VOCAB_SCHEMA_VERSION,
    entries: value.entries,
  };
}

async function saveVocabStore(store: VocabStore): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: store });
}

export async function lookupVocabEntry(original: string): Promise<VocabEntry | null> {
  const normalized = normalizeVocabKey(original);
  if (!normalized) {
    return null;
  }

  const store = await loadVocabStore();
  return store.entries[normalized] ?? null;
}

export async function createVocabEntry(input: VocabCreateInput): Promise<VocabEntry> {
  const normalized = normalizeVocabKey(input.original);
  if (!normalized) {
    throw new Error("Could not normalize vocabulary entry.");
  }

  const store = await loadVocabStore();
  const existing = store.entries[normalized];
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const entry: VocabEntry = {
    id: createEntryId(),
    original: input.original,
    normalized,
    translation: input.translation,
    note: "",
    contexts: [createContext(input.context)],
    createdAt: now,
    updatedAt: now,
  };

  store.entries[normalized] = entry;
  await saveVocabStore(store);
  return entry;
}

export async function addVocabContext(
  normalized: string,
  context: VocabContextInput,
): Promise<VocabEntry> {
  const store = await loadVocabStore();
  const entry = store.entries[normalized];
  if (!entry) {
    throw new Error("Vocabulary entry not found.");
  }

  const nextEntry: VocabEntry = {
    ...entry,
    contexts: [...entry.contexts, createContext(context)],
    updatedAt: Date.now(),
  };

  store.entries[normalized] = nextEntry;
  await saveVocabStore(store);
  return nextEntry;
}

export async function deleteVocabContext(
  normalized: string,
  contextId: string,
): Promise<VocabEntry> {
  const store = await loadVocabStore();
  const entry = store.entries[normalized];
  if (!entry) {
    throw new Error("Vocabulary entry not found.");
  }

  const nextContexts = entry.contexts.filter((context) => context.id !== contextId);
  if (nextContexts.length === entry.contexts.length) {
    throw new Error("Context not found.");
  }

  const nextEntry: VocabEntry = {
    ...entry,
    contexts: nextContexts,
    updatedAt: Date.now(),
  };

  store.entries[normalized] = nextEntry;
  await saveVocabStore(store);
  return nextEntry;
}

export async function updateVocabNote(
  normalized: string,
  note: string,
): Promise<VocabEntry> {
  const store = await loadVocabStore();
  const entry = store.entries[normalized];
  if (!entry) {
    throw new Error("Vocabulary entry not found.");
  }

  const nextEntry: VocabEntry = {
    ...entry,
    note,
    updatedAt: Date.now(),
  };

  store.entries[normalized] = nextEntry;
  await saveVocabStore(store);
  return nextEntry;
}

export async function listVocabEntries(): Promise<VocabEntry[]> {
  const store = await loadVocabStore();
  return Object.values(store.entries).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getVocabEntryByNormalized(
  normalized: string,
): Promise<VocabEntry | null> {
  const store = await loadVocabStore();
  return store.entries[normalized] ?? null;
}

export async function deleteVocabEntry(normalized: string): Promise<void> {
  const store = await loadVocabStore();
  if (!store.entries[normalized]) {
    throw new Error("Vocabulary entry not found.");
  }

  const { [normalized]: _removed, ...rest } = store.entries;
  await saveVocabStore({
    ...store,
    entries: rest,
  });
}

export async function exportVocab(): Promise<VocabExport> {
  const store = await loadVocabStore();
  return {
    schemaVersion: VOCAB_SCHEMA_VERSION,
    exportedAt: Date.now(),
    entries: Object.values(store.entries).sort((a, b) => b.updatedAt - a.updatedAt),
  };
}

export async function importVocab(data: VocabExport): Promise<{
  imported: number;
  merged: number;
}> {
  if (data.schemaVersion !== VOCAB_SCHEMA_VERSION || !Array.isArray(data.entries)) {
    throw new Error("Unsupported vocabulary export format.");
  }

  const store = await loadVocabStore();
  let imported = 0;
  let merged = 0;

  for (const entry of data.entries) {
    if (!entry?.normalized || typeof entry.normalized !== "string") {
      continue;
    }

    const existing = store.entries[entry.normalized];
    if (!existing) {
      store.entries[entry.normalized] = entry;
      imported += 1;
      continue;
    }

    store.entries[entry.normalized] = {
      ...existing,
      ...entry,
      contexts: [...existing.contexts, ...entry.contexts],
      updatedAt: Math.max(existing.updatedAt, entry.updatedAt),
    };
    merged += 1;
  }

  await saveVocabStore(store);
  return { imported, merged };
}
