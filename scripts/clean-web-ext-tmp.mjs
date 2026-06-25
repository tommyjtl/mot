/** @deprecated Use scripts/dev-storage.mjs --clean-tmp */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "dev-storage.mjs");
const result = spawnSync(process.execPath, [script, "--clean-tmp", ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
