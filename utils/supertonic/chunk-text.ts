const ABBREVIATIONS_PATTERN =
  /(?<!Mr\.)(?<!Mrs\.)(?<!Ms\.)(?<!Dr\.)(?<!Prof\.)(?<!Sr\.)(?<!Jr\.)(?<!Ph\.D\.)(?<!etc\.)(?<!e\.g\.)(?<!i\.e\.)(?<!vs\.)(?<!Inc\.)(?<!Ltd\.)(?<!Co\.)(?<!Corp\.)(?<!St\.)(?<!Ave\.)(?<!Blvd\.)(?<!\b[A-Z]\.)(?<=[.!?])\s+/;

export function chunkText(text: string, maxLen = 300): string[] {
  if (maxLen < 10) {
    throw new Error(`max_len must be at least 10, got ${maxLen}`);
  }

  const paragraphs = text
    .trim()
    .split(/\n\s*\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    const sentences = paragraph.split(ABBREVIATIONS_PATTERN);
    let currentChunk = "";

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) {
        continue;
      }

      if (currentChunk.length + trimmed.length + 1 <= maxLen) {
        currentChunk += `${currentChunk ? " " : ""}${trimmed}`;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = trimmed;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
  }

  return chunks.length > 0 ? chunks : [text.trim()];
}
