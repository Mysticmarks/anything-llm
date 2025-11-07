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
const node = process.platform === "win32" ? "node.exe" : "node";

function runLinting() {
  runCommand(yarn, ["lint"]);
}

function runTypeChecks() {
  runCommand(npx, ["flow", "check"], { cwd: path.join(repoRoot, "server") });
}

function runSmokeBenchmarks() {
  if (process.env.SKIP_SMOKE_BENCHMARKS === "true") return;
  const env = {
    ANYTHINGLLM_API_KEY: process.env.ANYTHINGLLM_API_KEY || "integration-test-key",
    LOADTEST_WORKSPACE: process.env.LOADTEST_WORKSPACE || "regression",
    LOADTEST_BASE_URL: process.env.LOADTEST_BASE_URL || "http://127.0.0.1:3001",
  };
  runCommand(node, ["./scripts/load-test.mjs", "--scenario=chat", "--iterations=1", "--concurrency=1"], {
    env,
  });
}

const scopeRunners = {
  server: () =>
    runCommand(npx, ["jest", "--testPathPattern", "server/__tests__"], { cwd: repoRoot }),
  collector: () =>
    runCommand(npx, ["jest", "--testPathPattern", "collector/__tests__"], { cwd: repoRoot }),
  frontend: () => {
    runCommand(yarn, ["--cwd", path.join(repoRoot, "frontend"), "build"]);
    runCommand(yarn, ["--cwd", path.join(repoRoot, "frontend"), "test:e2e"]);
  },
};

const scopes = process.argv.slice(2).filter(Boolean);

if (scopes.length === 0) {
  runLinting();
  runTypeChecks();
  runSmokeBenchmarks();
  runCommand(npx, ["jest"], { cwd: repoRoot });
  scopeRunners.frontend();
} else {
  for (const scope of scopes) {
    const runner = scopeRunners[scope];
    if (!runner) {
      console.error(
        `Unknown test scope "${scope}". Available scopes: ${Object.keys(scopeRunners).join(", ")}.`
      );
      process.exit(1);
    }
    runner();
  }
}
