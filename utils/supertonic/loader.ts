import * as ort from "onnxruntime-web";

import { assetByteSize } from "./asset-sizes";
import {
  ModelLoadTracker,
  type ModelLoadProgress,
} from "./load-progress";
import { Style, TextToSpeech } from "./text-to-speech";
import {
  ONNX_MODEL_FILES,
  voiceStylePath,
  type SupertonicLang,
} from "./constants";
import {
  fetchCachedArrayBuffer,
  fetchCachedJson,
} from "./model-cache";
import { UnicodeProcessor } from "./unicode-processor";

export type { ModelLoadProgress };

type VoiceStyleJson = {
  style_ttl: { dims: number[]; data: number[][][] | number[] };
  style_dp: { dims: number[]; data: number[][][] | number[] };
};

function configureOrtWasm(): void {
  const baseUrl = browser.runtime.getURL("/ort/");
  ort.env.wasm.wasmPaths = baseUrl;
  ort.env.wasm.numThreads = 1;
}

function emitProgress(
  tracker: ModelLoadTracker,
  onProgress?: (progress: ModelLoadProgress) => void,
  detail?: string,
): void {
  onProgress?.(tracker.snapshot(detail));
}

async function loadCachedJsonAsset<T>(
  path: string,
  tracker: ModelLoadTracker,
  onProgress?: (progress: ModelLoadProgress) => void,
): Promise<T> {
  tracker.startAsset(path, assetByteSize(path));
  const data = await fetchCachedJson<T>(path, (loaded, total) => {
    tracker.updateAsset(loaded, total);
    emitProgress(tracker, onProgress);
  });
  tracker.completeAsset(assetByteSize(path));
  emitProgress(tracker, onProgress);
  return data;
}

async function createSession(
  modelPath: string,
  providers: string[],
  tracker: ModelLoadTracker,
  onProgress?: (progress: ModelLoadProgress) => void,
): Promise<ort.InferenceSession> {
  tracker.startAsset(modelPath, assetByteSize(modelPath));

  const buffer = await fetchCachedArrayBuffer(modelPath, (loaded, total) => {
    tracker.updateAsset(loaded, total);
    emitProgress(tracker, onProgress);
  });

  tracker.completeAsset(buffer.byteLength || assetByteSize(modelPath));
  emitProgress(tracker, onProgress);

  return ort.InferenceSession.create(buffer, {
    executionProviders: providers,
    graphOptimizationLevel: "all",
  });
}

export async function loadTextToSpeech(
  onProgress?: (progress: ModelLoadProgress) => void,
): Promise<TextToSpeech> {
  configureOrtWasm();
  const tracker = new ModelLoadTracker();

  emitProgress(tracker, onProgress, "Preparing ONNX Runtime…");

  const cfgs = await loadCachedJsonAsset<{
    ae: { sample_rate: number; base_chunk_size: number };
    ttl: { chunk_compress_factor: number; latent_dim: number };
  }>("onnx/tts.json", tracker, onProgress);

  const indexer = await loadCachedJsonAsset<number[]>(
    "onnx/unicode_indexer.json",
    tracker,
    onProgress,
  );

  const textProcessor = new UnicodeProcessor(indexer);

  const modelNames = [
    "Duration Predictor",
    "Text Encoder",
    "Vector Estimator",
    "Vocoder",
  ];

  let providers = ["webgpu", "wasm"];
  let sessions: ort.InferenceSession[] | null = null;

  const loadSessions = async (executionProviders: string[]): Promise<ort.InferenceSession[]> => {
    const loaded: ort.InferenceSession[] = [];
    for (let index = 0; index < ONNX_MODEL_FILES.length; index += 1) {
      tracker.setInitStep(index, ONNX_MODEL_FILES.length, `Initializing ${modelNames[index]}…`);
      emitProgress(tracker, onProgress);
      loaded.push(
        await createSession(
          ONNX_MODEL_FILES[index]!,
          executionProviders,
          tracker,
          onProgress,
        ),
      );
      tracker.setInitStep(index + 1, ONNX_MODEL_FILES.length, `Initialized ${modelNames[index]}`);
      emitProgress(tracker, onProgress);
    }
    return loaded;
  };

  try {
    sessions = await loadSessions(["webgpu"]);
  } catch {
    providers = ["wasm"];
    tracker.setInitStep(0, ONNX_MODEL_FILES.length, "Retrying with WebAssembly…");
    emitProgress(tracker, onProgress);
    sessions = await loadSessions(["wasm"]);
  }

  const [dpOrt, textEncOrt, vectorEstOrt, vocoderOrt] = sessions;
  console.info("[mot] Supertonic using", providers[0]);

  onProgress?.(tracker.finish());
  return new TextToSpeech(cfgs, textProcessor, dpOrt, textEncOrt, vectorEstOrt, vocoderOrt);
}

export async function loadVoiceStyle(
  voice: string,
  onProgress?: (progress: ModelLoadProgress) => void,
): Promise<Style> {
  const tracker = new ModelLoadTracker();
  const path = voiceStylePath(voice);
  tracker.markVoiceLoaded();

  const voiceStyle = await loadCachedJsonAsset<VoiceStyleJson>(
    path,
    tracker,
    onProgress,
  );

  const flatten = (value: unknown): number[] => {
    if (Array.isArray(value)) {
      return value.flatMap(flatten);
    }
    return [Number(value)];
  };

  const ttlFlat = Float32Array.from(flatten(voiceStyle.style_ttl.data));
  const dpFlat = Float32Array.from(flatten(voiceStyle.style_dp.data));

  return new Style(
    new ort.Tensor("float32", ttlFlat, voiceStyle.style_ttl.dims as [number, number, number]),
    new ort.Tensor("float32", dpFlat, voiceStyle.style_dp.dims as [number, number, number]),
  );
}

export type { SupertonicLang };
