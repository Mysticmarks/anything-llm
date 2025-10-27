import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { startFrontend } from "./start-frontend.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const children = [];
let shuttingDown = false;

const terminateChild = (child, signal = "SIGTERM") => {
  if (!child) return;
  if (typeof child.stop === "function") {
    child.stop(signal);
    return;
  }

  if (typeof child.kill === "function") {
    child.kill(signal);
  }
};

const shutdown = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("Shutting down AnythingLLM stack...");
  children.forEach((child) => terminateChild(child));
  setTimeout(() => {
    process.exit(exitCode);
  }, 500);
};

function spawnYarnProcess(label, cwd, script) {
  const child = spawn("yarn", [script], {
    cwd,
    env: process.env,
    stdio: "inherit",
  });

  child.once("exit", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.log(`[${label}] process exited with ${reason}`);
    shutdown(code ?? 0);
  });

  child.once("error", (error) => {
    console.error(`[${label}] failed to start`, error);
    shutdown(1);
  });

  children.push(child);
  return child;
}

const serverDir = path.resolve(__dirname, "../server");
const collectorDir = path.resolve(__dirname, "../collector");

spawnYarnProcess("server", serverDir, "start");
spawnYarnProcess("collector", collectorDir, "start");

const skipBuild = process.env.SKIP_FRONTEND_BUILD === "true";
const disableFrontend = process.env.DISABLE_FRONTEND_PROCESS === "true";
let frontendController = null;

(async () => {
  try {
    if (!disableFrontend) {
      frontendController = await startFrontend({ persist: true, skipBuild });
      if (frontendController?.child) {
        frontendController.child.once("exit", (code, signal) => {
          const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
          console.log(`[frontend] preview exited with ${reason}`);
          shutdown(code ?? 0);
        });
      }
      if (frontendController) {
        children.push(frontendController);
      }
    } else {
      console.log("Frontend process disabled by DISABLE_FRONTEND_PROCESS env.");
    }
  } catch (error) {
    console.error("Failed to launch frontend preview", error);
    shutdown(1);
  }
})();

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
