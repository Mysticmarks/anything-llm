import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...options.env },
    cwd: options.cwd || repoRoot,
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const yarn = process.platform === "win32" ? "yarn.cmd" : "yarn";

runCommand(npx, ["jest"], { cwd: repoRoot });
runCommand(yarn, ["--cwd", path.join(repoRoot, "frontend"), "test:e2e"], {
  cwd: repoRoot,
});
