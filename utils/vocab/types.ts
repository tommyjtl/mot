export const VOCAB_SCHEMA_VERSION = 1;

export type VocabContext = {
  id: string;
  sentence: string;
  url: string;
  pageTitle?: string;
  addedAt: number;
};

export type VocabEntry = {
  id: string;
  original: string;
  normalized: string;
  translation: string;
  note: string;
  contexts: VocabContext[];
  createdAt: number;
  updatedAt: number;
};

export type VocabStore = {
  schemaVersion: number;
  entries: Record<string, VocabEntry>;
};

export type VocabExport = {
  schemaVersion: number;
  exportedAt: number;
  entries: VocabEntry[];
};

export type VocabContextInput = {
  sentence: string;
  url: string;
  pageTitle?: string;
};

export type VocabCreateInput = {
  original: string;
  translation: string;
  context: VocabContextInput;
};
