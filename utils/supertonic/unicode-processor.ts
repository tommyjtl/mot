import { AVAILABLE_LANGS, type SupertonicLang } from "./constants";

export function isValidLang(lang: string): lang is SupertonicLang {
  return (AVAILABLE_LANGS as readonly string[]).includes(lang);
}

export class UnicodeProcessor {
  constructor(private readonly indexer: number[]) {}

  call(
    textList: string[],
    langList: string[],
  ): {
    textIds: number[][];
    textMask: number[][][];
    preprocessedTexts: string[];
  } {
    const preprocessedTexts = textList.map((text, index) =>
      this.preprocessText(text, langList[index] ?? "na"),
    );

    const textIdsLengths = preprocessedTexts.map((text) => text.length);
    const maxLen = Math.max(...textIdsLengths, 1);

    const textIds = preprocessedTexts.map((text) => {
      const row = new Array<number>(maxLen).fill(0);
      for (let index = 0; index < text.length; index += 1) {
        const codePoint = text.codePointAt(index);
        if (codePoint === undefined) {
          continue;
        }
        row[index] =
          codePoint < this.indexer.length ? (this.indexer[codePoint] ?? -1) : -1;
      }
      return row;
    });

    const textMask = this.getTextMask(textIdsLengths, maxLen);
    return { textIds, textMask, preprocessedTexts };
  }

  preprocessText(text: string, lang: string): string {
    if (!isValidLang(lang)) {
      throw new Error(
        `Invalid language: ${lang}. Available: ${AVAILABLE_LANGS.join(", ")}`,
      );
    }

    let processed = text.normalize("NFKD");

    const emojiPattern =
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu;
    processed = processed.replace(emojiPattern, "");

    const replacements: Record<string, string> = {
      "–": "-",
      "‑": "-",
      "—": "-",
      _: " ",
      "\u201C": '"',
      "\u201D": '"',
      "\u2018": "'",
      "\u2019": "'",
      "´": "'",
      "`": "'",
      "[": " ",
      "]": " ",
      "|": " ",
      "/": " ",
      "#": " ",
      "→": " ",
      "←": " ",
    };

    for (const [from, to] of Object.entries(replacements)) {
      processed = processed.replaceAll(from, to);
    }

    processed = processed.replace(/[♥☆♡©\\]/g, "");

    const exprReplacements: Record<string, string> = {
      "@": " at ",
      "e.g.,": "for example, ",
      "i.e.,": "that is, ",
    };
    for (const [from, to] of Object.entries(exprReplacements)) {
      processed = processed.replaceAll(from, to);
    }

    processed = processed.replace(/ ,/g, ",");
    processed = processed.replace(/ \./g, ".");
    processed = processed.replace(/ !/g, "!");
    processed = processed.replace(/ \?/g, "?");
    processed = processed.replace(/ ;/g, ";");
    processed = processed.replace(/ :/g, ":");
    processed = processed.replace(/ '/g, "'");

    while (processed.includes('""')) {
      processed = processed.replace('""', '"');
    }
    while (processed.includes("''")) {
      processed = processed.replace("''", "'");
    }
    while (processed.includes("``")) {
      processed = processed.replace("``", "`");
    }

    processed = processed.replace(/\s+/g, " ").trim();

    if (!/[.!?;:,'"')\]}…。」』】〉》›»]$/.test(processed)) {
      processed += ".";
    }

    return `<${lang}>${processed}</${lang}>`;
  }

  private getTextMask(textIdsLengths: number[], maxLen: number): number[][][] {
    return textIdsLengths.map((length) => {
      const row = new Array<number>(maxLen).fill(0);
      for (let index = 0; index < Math.min(length, maxLen); index += 1) {
        row[index] = 1;
      }
      return [row];
    });
  }
}
