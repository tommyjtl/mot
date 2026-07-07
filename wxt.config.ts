import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

/**
 * @note
 * - https://www.youtube.com/watch?v=axzZ3zvdA9M
 * - https://www.rfi.fr/fr/france/
 * - https://www.instagram.com/p/DWrTxvjgv_g/
 * - https://www.youtube.com/watch?v=IVo5R2yaxB0
 * - https://youtu.be/tA3YBYYmIrg?t=18
 */
const DEV_START_URL =
  "https://www.instagram.com/p/DVhOI4IDe30/";

/** Reuse one Chrome profile during dev instead of tmp-web-ext copies (~400 MB/model each). */
const DEV_CHROME_PROFILE = resolve(".wxt/chrome-data");

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  webExt: {
    chromiumArgs: [`--user-data-dir=${DEV_CHROME_PROFILE}`],
    startUrls: [DEV_START_URL],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["onnxruntime-web"],
    },
    resolve: {
      alias: {
        "@": resolve("."),
      },
    },
  }),
  manifest: {
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    name: "Motif",
    theme_color: "#f1c057",
    description:
      "Hear it, save it, remember it. On-device French pronunciation and live tab transcription.",
    permissions: ["storage", "activeTab", "tabs", "offscreen", "tabCapture", "identity"],
    commands: {
      "speak-selection": {
        suggested_key: {
          default: "Alt+S",
          mac: "Alt+S",
        },
        description: "Speak selected text on the active page",
      },
      "transcribe-tab": {
        suggested_key: {
          default: "Alt+T",
          mac: "Alt+T",
        },
        description: "Transcribe audio from the active tab",
      },
    },
    host_permissions: [
      "https://huggingface.co/*",
      "https://motif-cloud.tjtl.io/*",
    ],
    web_accessible_resources: [
      {
        resources: ["ort/*", "tesseract/*", "tesseract/tessdata/*", "stt/*", "stt/pkg/*"],
        matches: ["<all_urls>"],
      },
    ],
  },
});
