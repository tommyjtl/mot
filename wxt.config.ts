import { defineConfig } from "wxt";

const DEV_START_URL =
  "https://www.lemonde.fr/planete/live/2026/06/19/en-direct-canicule-la-vague-de-chaleur-pourrait-etre-d-une-duree-et-d-une-severite-identiques-a-celle-d-aout-2003-dit-meteo-france_6704498_3244.html";

export default defineConfig({
  webExt: {
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
        resources: ["ort/*"],
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
