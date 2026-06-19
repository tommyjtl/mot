import * as ort from "onnxruntime-web";

import {
  buildAlignment,
  extractSpeakableText,
  joinDisplayText,
  scaleWordTimings,
  wordAlignmentFromPreprocessed,
} from "./alignment";
import {
  DEFAULT_SILENCE_DURATION,
  DEFAULT_SPEED,
  type SupertonicLang,
} from "./constants";
import type { TtsAlignment } from "../tts-types";
import { audioDurationSeconds } from "./wav";
import { chunkText } from "./chunk-text";
import { UnicodeProcessor } from "./unicode-processor";

export class Style {
  constructor(
    readonly ttl: ort.Tensor,
    readonly dp: ort.Tensor,
  ) {}
}

type TtsConfig = {
  ae: { sample_rate: number; base_chunk_size: number };
  ttl: { chunk_compress_factor: number; latent_dim: number };
};

type InferChunkResult = {
  wav: number[];
  charDurations: number[];
  preprocessedText: string;
  speechDuration: number;
};

export class TextToSpeech {
  readonly sampleRate: number;

  constructor(
    private readonly cfgs: TtsConfig,
    readonly textProcessor: UnicodeProcessor,
    private readonly dpOrt: ort.InferenceSession,
    private readonly textEncOrt: ort.InferenceSession,
    private readonly vectorEstOrt: ort.InferenceSession,
    private readonly vocoderOrt: ort.InferenceSession,
  ) {
    this.sampleRate = cfgs.ae.sample_rate;
  }

  async callWithAlignment(
    text: string,
    lang: SupertonicLang,
    style: Style,
    totalStep = 8,
    speed = DEFAULT_SPEED,
    silenceDuration = DEFAULT_SILENCE_DURATION,
  ): Promise<{
    wav: number[];
    displayText: string;
    alignment: TtsAlignment;
    durationSeconds: number;
  }> {
    const maxLen = lang === "ko" || lang === "ja" ? 120 : 300;
    const chunks = chunkText(text, maxLen);
    let wavCat: number[] = [];
    let timeOffset = 0;
    const displayParts: string[] = [];
    const allWords: TtsAlignment["words"] = [];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const chunk = chunks[chunkIndex]!;
      const {
        wav,
        charDurations,
        preprocessedText,
        speechDuration,
      } = await this.inferChunk([chunk], [lang], style, totalStep, speed);

      const { inner } = extractSpeakableText(preprocessedText);
      displayParts.push(inner);

      const { words, timelineEnd } = wordAlignmentFromPreprocessed(
        preprocessedText,
        charDurations,
        0,
        allWords.length,
      );

      const chunkStart = timeOffset;
      const scaledWords = scaleWordTimings(
        words,
        0,
        timelineEnd,
        speechDuration,
      ).map((word) => ({
        ...word,
        start: chunkStart + word.start,
        end: chunkStart + word.end,
      }));

      allWords.push(...scaledWords);

      if (wavCat.length === 0) {
        wavCat = wav;
      } else {
        const silenceLen = Math.floor(silenceDuration * this.sampleRate);
        wavCat = [...wavCat, ...new Array<number>(silenceLen).fill(0), ...wav];
      }

      timeOffset += speechDuration;
      if (chunkIndex < chunks.length - 1) {
        timeOffset += silenceDuration;
      }
    }

    return {
      wav: wavCat,
      displayText: joinDisplayText(displayParts),
      alignment: buildAlignment(allWords),
      durationSeconds: audioDurationSeconds(wavCat.length, this.sampleRate),
    };
  }

  private async inferChunk(
    textList: string[],
    langList: string[],
    style: Style,
    totalStep: number,
    speed: number,
  ): Promise<InferChunkResult> {
    const bsz = textList.length;
    const { textIds, textMask, preprocessedTexts } = this.textProcessor.call(
      textList,
      langList,
    );

    const textIdsFlat = BigInt64Array.from(textIds.flat().map((value) => BigInt(value)));
    const textIdsTensor = new ort.Tensor("int64", textIdsFlat, [bsz, textIds[0]?.length ?? 0]);

    const textMaskFlat = Float32Array.from(textMask.flat(2));
    const textMaskTensor = new ort.Tensor("float32", textMaskFlat, [
      bsz,
      1,
      textMask[0]?.[0]?.length ?? 0,
    ]);

    const dpOutputs = await this.dpOrt.run({
      text_ids: textIdsTensor,
      style_dp: style.dp,
      text_mask: textMaskTensor,
    });

    const duration = Array.from(dpOutputs.duration!.data as Float32Array).map(
      (value) => value / speed,
    );

    const textEncOutputs = await this.textEncOrt.run({
      text_ids: textIdsTensor,
      style_ttl: style.ttl,
      text_mask: textMaskTensor,
    });
    const textEmb = textEncOutputs.text_emb as ort.Tensor;

    let { xt, latentMask } = this.sampleNoisyLatent(
      duration,
      this.sampleRate,
      this.cfgs.ae.base_chunk_size,
      this.cfgs.ttl.chunk_compress_factor,
      this.cfgs.ttl.latent_dim,
    );

    const latentMaskFlat = Float32Array.from(latentMask.flat(2));
    const latentMaskTensor = new ort.Tensor("float32", latentMaskFlat, [
      bsz,
      1,
      latentMask[0]?.[0]?.length ?? 0,
    ]);

    const totalStepTensor = new ort.Tensor(
      "float32",
      new Float32Array(bsz).fill(totalStep),
      [bsz],
    );

    for (let step = 0; step < totalStep; step += 1) {
      const currentStepTensor = new ort.Tensor(
        "float32",
        new Float32Array(bsz).fill(step),
        [bsz],
      );

      const xtFlat = Float32Array.from(xt.flat(2));
      const xtTensor = new ort.Tensor("float32", xtFlat, [
        bsz,
        xt[0]?.length ?? 0,
        xt[0]?.[0]?.length ?? 0,
      ]);

      const vectorEstOutputs = await this.vectorEstOrt.run({
        noisy_latent: xtTensor,
        text_emb: textEmb,
        style_ttl: style.ttl,
        latent_mask: latentMaskTensor,
        text_mask: textMaskTensor,
        current_step: currentStepTensor,
        total_step: totalStepTensor,
      });

      const denoised = Array.from(
        vectorEstOutputs.denoised_latent!.data as Float32Array,
      );

      const latentDim = xt[0]?.length ?? 0;
      const latentLen = xt[0]?.[0]?.length ?? 0;
      xt = [];
      let index = 0;
      for (let batch = 0; batch < bsz; batch += 1) {
        const batchRows: number[][] = [];
        for (let dim = 0; dim < latentDim; dim += 1) {
          const row: number[] = [];
          for (let time = 0; time < latentLen; time += 1) {
            row.push(denoised[index] ?? 0);
            index += 1;
          }
          batchRows.push(row);
        }
        xt.push(batchRows);
      }
    }

    const finalXtFlat = Float32Array.from(xt.flat(2));
    const finalXtTensor = new ort.Tensor("float32", finalXtFlat, [
      bsz,
      xt[0]?.length ?? 0,
      xt[0]?.[0]?.length ?? 0,
    ]);

    const vocoderOutputs = await this.vocoderOrt.run({
      latent: finalXtTensor,
    });

    const wav = Array.from(vocoderOutputs.wav_tts!.data as Float32Array);
    const preprocessedText = preprocessedTexts[0] ?? textList[0] ?? "";
    const validCharCount = preprocessedText.length;

    return {
      wav,
      charDurations: duration.slice(0, validCharCount),
      preprocessedText,
      speechDuration: audioDurationSeconds(wav.length, this.sampleRate),
    };
  }

  private sampleNoisyLatent(
    duration: number[],
    sampleRate: number,
    baseChunkSize: number,
    chunkCompress: number,
    latentDim: number,
  ): { xt: number[][][]; latentMask: number[][][] } {
    const bsz = duration.length;
    const maxDur = Math.max(...duration);
    const wavLenMax = Math.floor(maxDur * sampleRate);
    const wavLengths = duration.map((value) => Math.floor(value * sampleRate));
    const chunkSize = baseChunkSize * chunkCompress;
    const latentLen = Math.floor((wavLenMax + chunkSize - 1) / chunkSize);
    const latentDimVal = latentDim * chunkCompress;

    const xt: number[][][] = [];
    for (let batch = 0; batch < bsz; batch += 1) {
      const batchRows: number[][] = [];
      for (let dim = 0; dim < latentDimVal; dim += 1) {
        const row: number[] = [];
        for (let time = 0; time < latentLen; time += 1) {
          const u1 = Math.max(0.0001, Math.random());
          const u2 = Math.random();
          row.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
        }
        batchRows.push(row);
      }
      xt.push(batchRows);
    }

    const latentLengths = wavLengths.map((length) =>
      Math.floor((length + chunkSize - 1) / chunkSize),
    );
    const latentMask = this.lengthToMask(latentLengths, latentLen);

    for (let batch = 0; batch < bsz; batch += 1) {
      for (let dim = 0; dim < latentDimVal; dim += 1) {
        for (let time = 0; time < latentLen; time += 1) {
          xt[batch]![dim]![time]! *= latentMask[batch]?.[0]?.[time] ?? 0;
        }
      }
    }

    return { xt, latentMask };
  }

  private lengthToMask(lengths: number[], maxLen: number): number[][][] {
    return lengths.map((length) => {
      const row = new Array<number>(maxLen).fill(0);
      for (let index = 0; index < Math.min(length, maxLen); index += 1) {
        row[index] = 1;
      }
      return [row];
    });
  }
}
