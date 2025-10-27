import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "../frontend");

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: frontendDir,
      stdio: "inherit",
      env: { ...process.env, ...options.env },
    });

    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
      }
    });

    child.once("error", (error) => {
      reject(error);
    });
  });
}

export async function startFrontend({ persist = false, skipBuild = false } = {}) {
  if (!skipBuild) {
    await runCommand("yarn", ["build"]);
  }

  const host = process.env.FRONTEND_HOST || "0.0.0.0";
  const port = process.env.FRONTEND_PORT || "4173";
  const previewArgs = ["preview", "--host", host, "--port", port];
  const preview = spawn("yarn", previewArgs, {
    cwd: frontendDir,
    stdio: "inherit",
    env: process.env,
  });

  const stop = (signal = "SIGTERM") => {
    if (!preview.killed) {
      preview.kill(signal);
    }
  };

  if (!persist) {
    await new Promise((resolve, reject) => {
      preview.once("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Frontend preview exited with code ${code}`));
        }
      });

      preview.once("error", (error) => {
        reject(error);
      });
    });
    return;
  }

  preview.once("error", (error) => {
    console.error("[frontend] failed to start preview server", error);
  });

  return { child: preview, stop };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  startFrontend().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
