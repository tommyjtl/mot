import { AuthRequiredError, fetchRemote } from "../remote-api";
import { isCloudRuntimeMode } from "../runtime-mode-store";
import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResponse,
} from "./types";

export const remoteTranslatorProvider: TranslationProvider = {
  id: "mot-remote-translator",

  isSupported(): boolean {
    return isCloudRuntimeMode();
  },

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const trimmed = request.text.trim();
    if (!trimmed) {
      return { ok: false, error: "Nothing to translate." };
    }

    if (!this.isSupported()) {
      return {
        ok: false,
        error: "Remote translation is only available in cloud mode.",
        unavailable: true,
      };
    }

    try {
      const response = await fetchRemote("/v1/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: trimmed,
          source: request.sourceLanguage,
          target: request.targetLanguage,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        if (response.status === 401 || response.status === 403) {
          return {
            ok: false,
            error: "Motif Cloud sign-in required or account not authorized.",
            unavailable: true,
          };
        }

        return {
          ok: false,
          error: detail || `Remote translation failed (${response.status}).`,
          unavailable: response.status >= 500,
        };
      }

      const payload = (await response.json()) as { text?: string };
      if (!payload.text) {
        return {
          ok: false,
          error: "Remote translation returned an empty response.",
          unavailable: true,
        };
      }

      return { ok: true, text: payload.text };
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        return {
          ok: false,
          error: error.message,
          unavailable: true,
        };
      }

      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not reach the Motif server.",
        unavailable: true,
      };
    }
  },
};
