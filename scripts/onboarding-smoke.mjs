import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const shouldSkip =
  process.env.SKIP_ONBOARDING_SMOKE === "true" || process.env.CI === "true";

if (shouldSkip) {
  console.log("[onboarding-smoke] Skipping onboarding smoke tests.");
  console.log(
    "[onboarding-smoke] Run `yarn onboarding:smoke` later to verify the UI when ready."
  );
  process.exit(0);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const stackScript = path.resolve(repoRoot, "scripts/start-stack.mjs");
const frontendHost = process.env.FRONTEND_HOST || "127.0.0.1";
const frontendPort = process.env.FRONTEND_PORT || "4173";
const serverPort = process.env.SERVER_PORT || "3001";
const serverUrl =
  process.env.ONBOARDING_SMOKE_SERVER_URL || `http://127.0.0.1:${serverPort}/api/health`;
const uiUrl =
  process.env.ONBOARDING_SMOKE_UI_URL || `http://${frontendHost}:${frontendPort}`;

const stackEnv = {
  ...process.env,
  SKIP_FRONTEND_BUILD: process.env.SKIP_FRONTEND_BUILD || "true",
  SHOULD_SUPERVISE: "false",
  SERVER_SHOULD_SUPERVISE: "false",
  COLLECTOR_SHOULD_SUPERVISE: "false",
  FRONTEND_HOST: frontendHost,
  FRONTEND_PORT: frontendPort,
};

console.log("[onboarding-smoke] Starting AnythingLLM stack for smoke testing...");
const stack = spawn("node", [stackScript], {
  cwd: repoRoot,
  env: stackEnv,
  stdio: "inherit",
});

let testsCompleted = false;
const stackMonitor = new Promise((_, reject) => {
  stack.once("exit", (code, signal) => {
    if (testsCompleted) return;
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    reject(new Error(`Stack exited before smoke tests completed (${reason}).`));
  });
  stack.once("error", (error) => reject(error));
});

async function waitForHttp(url, { expectedStatus = 200, timeoutMs = 60000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status === expectedStatus) {
        return response;
      }
      lastError = new Error(`Unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(1500);
  }

  const reason = lastError?.message || "no response";
  throw new Error(`Timed out waiting for ${url}: ${reason}`);
}

async function runSmoke() {
  console.log(`[onboarding-smoke] Waiting for API health at ${serverUrl}`);
  const healthResponse = await waitForHttp(serverUrl);
  let healthBody = null;
  try {
    healthBody = await healthResponse.json();
  } catch (error) {
    throw new Error("API health endpoint did not return JSON.");
  }
  if (!healthBody || healthBody.status !== "ok") {
    throw new Error(
      `API health check returned unexpected payload: ${JSON.stringify(healthBody)}`
    );
  }

  console.log(`[onboarding-smoke] Waiting for frontend preview at ${uiUrl}`);
  const uiResponse = await waitForHttp(uiUrl, { expectedStatus: 200 });
  const html = await uiResponse.text();
  if (!html.toLowerCase().includes("<!doctype html")) {
    throw new Error("Frontend preview did not return an HTML document.");
  }

  console.log("[onboarding-smoke] UI responded with HTML content.");
  testsCompleted = true;
}

async function shutdownStack(signal = "SIGINT") {
  if (!stack.killed) {
    stack.kill(signal);
  }
  if (stack.exitCode === null) {
    await new Promise((resolve) => stack.once("exit", resolve));
  }
}

try {
  await Promise.race([stackMonitor, runSmoke()]);
  console.log("[onboarding-smoke] Smoke tests completed, stopping stack...");
  await shutdownStack();
  console.log(
    "[onboarding-smoke] Success! Start developing with `yarn dev:server`, `yarn dev:collector`, and `yarn dev:frontend`."
  );
} catch (error) {
  console.error(`\x1b[31m[onboarding-smoke]\x1b[0m ${error.message}`);
  await shutdownStack();
  console.error(
    "\x1b[31m[onboarding-smoke]\x1b[0m Ensure Redis and required services are running (try `yarn provision:deps`)."
  );
  process.exit(1);
}
