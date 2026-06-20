import { createWorker, type Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;

function tesseractAssetUrl(relativePath: string): string {
  return browser.runtime.getURL(`tesseract/${relativePath}`);
}

async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("fra", 1, {
      workerPath: tesseractAssetUrl("worker.min.js"),
      corePath: browser.runtime.getURL("tesseract/"),
      langPath: tesseractAssetUrl("tessdata"),
      workerBlobURL: false,
      gzip: true,
    });
  }

  return workerPromise;
}

export async function recognizeFrenchFromBase64(imageBase64: string): Promise<string> {
  const worker = await getOcrWorker();
  const result = await worker.recognize(`data:image/png;base64,${imageBase64}`);
  return result.data.text.replace(/\s+/g, " ").trim();
}

export async function warmUpOcrEngine(): Promise<void> {
  await getOcrWorker();
}
