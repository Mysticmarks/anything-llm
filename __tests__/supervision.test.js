const path = require("path");
const { spawn } = require("child_process");

jest.setTimeout(30000);

const runWithSupervision = (entryFile, envOverrides = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entryFile], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        SHOULD_SUPERVISE: "false",
        ...envOverrides,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    let stdout = "";

    const stopTimers = [];

    const cleanup = () => {
      while (stopTimers.length > 0) {
        const timer = stopTimers.pop();
        clearTimeout(timer);
      }
    };

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const gracefulShutdownTimer = setTimeout(() => {
      child.kill("SIGTERM");
    }, 1500);
    stopTimers.push(gracefulShutdownTimer);

    const forceShutdownTimer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 10000);
    stopTimers.push(forceShutdownTimer);

    child.on("exit", (code, signal) => {
      cleanup();
      if (stderr.includes("ReferenceError")) {
        reject(new Error(`Process emitted ReferenceError: ${stderr}`));
        return;
      }
      resolve({ code, signal, stdout, stderr });
    });

    child.on("error", (error) => {
      cleanup();
      reject(error);
    });
  });

describe("Supervisor boot", () => {
  test("server starts under supervision without ReferenceError", async () => {
    const entry = path.resolve(__dirname, "../server/index.js");

    const result = await runWithSupervision(entry, {
      SERVER_SHOULD_SUPERVISE: "true",
      SERVER_SUPERVISOR_WORKERS: "1",
      SERVER_SUPERVISOR_RESTART_DELAY_MS: "100",
      DISABLE_SERVER_JOB_WORKERS: "true",
      SERVER_PORT: "0",
    });

    expect([0, 1, null]).toContain(result.code);
    expect([null, "SIGTERM", "SIGKILL"]).toContain(result.signal);
  });

  test("collector starts under supervision without ReferenceError", async () => {
    const entry = path.resolve(__dirname, "../collector/index.js");

    const result = await runWithSupervision(entry, {
      COLLECTOR_SHOULD_SUPERVISE: "true",
      COLLECTOR_SUPERVISOR_WORKERS: "1",
      COLLECTOR_SUPERVISOR_RESTART_DELAY_MS: "100",
      COLLECTOR_PORT: "0",
      REDIS_URL: "redis://127.0.0.1:65534",
    });

    expect([0, 1, null]).toContain(result.code);
    expect([null, "SIGTERM", "SIGKILL"]).toContain(result.signal);
  });
});
