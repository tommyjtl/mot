export const OFFSCREEN_OCR = "mot-ocr-recognize";
export const OFFSCREEN_OCR_WARMUP = "mot-ocr-warmup";

export type OffscreenOcrResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function recognizeInOffscreen(imageBase64: string): Promise<OffscreenOcrResult> {
  const { ensureOffscreenDocument } = await import("./offscreen-tts");

  await ensureOffscreenDocument();

  try {
    return (await browser.runtime.sendMessage({
      type: OFFSCREEN_OCR,
      imageBase64,
    })) as OffscreenOcrResult;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not recognize text in image.",
    };
  }
}

export async function warmUpOffscreenOcr(): Promise<void> {
  const { ensureOffscreenDocument } = await import("./offscreen-tts");

  await ensureOffscreenDocument();

  try {
    await browser.runtime.sendMessage({ type: OFFSCREEN_OCR_WARMUP });
  } catch {
    // Offscreen may not be ready during extension reload.
  }
}
