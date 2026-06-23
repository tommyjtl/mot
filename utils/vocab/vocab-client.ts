import { browser } from "wxt/browser";
import type { Message } from "../messages";
import type { VocabContextInput, VocabCreateInput, VocabEntry, VocabExport } from "./types";

type VocabLookupResponse =
  | { ok: true; entry: VocabEntry | null }
  | { ok: false; error: string };

type VocabEntryResponse =
  | { ok: true; entry: VocabEntry }
  | { ok: false; error: string };

type VocabImportResponse =
  | { ok: true; imported: number; merged: number }
  | { ok: false; error: string };

type VocabExportResponse =
  | { ok: true; data: VocabExport }
  | { ok: false; error: string };

async function sendVocabMessage<T>(message: Message): Promise<T> {
  const response = await browser.runtime.sendMessage(message);
  if (response === undefined || response === null) {
    throw new Error("Extension background did not respond.");
  }

  return response as T;
}

export async function lookupVocabEntry(original: string): Promise<VocabEntry | null> {
  const response = await sendVocabMessage<VocabLookupResponse>({
    type: "vocab-lookup",
    original,
  });

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.entry;
}

export async function createVocabEntry(input: VocabCreateInput): Promise<VocabEntry> {
  const response = await sendVocabMessage<VocabEntryResponse>({
    type: "vocab-create",
    payload: input,
  });

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.entry;
}

export async function addVocabContext(
  normalized: string,
  context: VocabContextInput,
): Promise<VocabEntry> {
  const response = await sendVocabMessage<VocabEntryResponse>({
    type: "vocab-add-context",
    normalized,
    context,
  });

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.entry;
}

export async function deleteVocabContext(
  normalized: string,
  contextId: string,
): Promise<VocabEntry> {
  const response = await sendVocabMessage<VocabEntryResponse>({
    type: "vocab-delete-context",
    normalized,
    contextId,
  });

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.entry;
}

export async function updateVocabNote(
  normalized: string,
  note: string,
): Promise<VocabEntry> {
  const response = await sendVocabMessage<VocabEntryResponse>({
    type: "vocab-update-note",
    normalized,
    note,
  });

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.entry;
}

export async function exportVocabData(): Promise<VocabExport> {
  const response = await sendVocabMessage<VocabExportResponse>({
    type: "vocab-export",
  });

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.data;
}

export async function importVocabData(data: VocabExport): Promise<{
  imported: number;
  merged: number;
}> {
  const response = await sendVocabMessage<VocabImportResponse>({
    type: "vocab-import",
    data,
  });

  if (!response.ok) {
    throw new Error(response.error);
  }

  return { imported: response.imported, merged: response.merged };
}
