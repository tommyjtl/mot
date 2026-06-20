import { resolve } from "node:path";
import { defineConfig } from "wxt";

const DEV_START_URL =
  "https://www.rfi.fr/fr/france/";

/** Reuse one Chrome profile during dev instead of tmp-web-ext copies (~400 MB/model each). */
const DEV_CHROME_PROFILE = resolve(".wxt/chrome-data");

export default defineConfig({
  webExt: {
    chromiumArgs: [`--user-data-dir=${DEV_CHROME_PROFILE}`],
    startUrls: [DEV_START_URL],
  },
  vite: () => ({
    optimizeDeps: {
      exclude: ["onnxruntime-web"],
    },
  }),
  manifest: {
    name: "Mot",
    description:
      "Hear natural French pronunciation while reading the web, powered by on-device Supertonic TTS.",
    permissions: ["storage", "activeTab", "offscreen"],
    host_permissions: [
      "https://huggingface.co/*",
      "http://127.0.0.1:8091/*",
    ],
    web_accessible_resources: [
      {
        resources: ["ort/*", "tesseract/*", "tesseract/tessdata/*"],
        matches: ["<all_urls>"],
      },
    ],
    commands: {
      "speak-selection": {
        suggested_key: {
          default: "Alt+S",
          mac: "Alt+S",
        },
        description: "Speak the selected text aloud",
      },
    },
  },
});
