const path = require("path");
const { spawn } = require("child_process");

jest.setTimeout(20000);

function runScenario(scenario) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.resolve(__dirname, "./fixtures/chaos-supervisor.cjs"),
    ], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        SERVER_SHOULD_SUPERVISE: "true",
        SERVER_SUPERVISOR_WORKERS: "1",
        SERVER_SUPERVISOR_RESTART_DELAY_MS: "150",
        CHAOS_SCENARIO: scenario,
        CHAOS_EXPECTED_RESTARTS: "1",
        CHAOS_MAX_DURATION_MS: "1500",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", reject);
    child.on("exit", () => resolve({ stdout, stderr }));
  });
}

describe("chaos resilience", () => {
  test("worker crash restarts after backoff", async () => {
    const result = await runScenario("crash");
    expect(result.stdout).toContain("restart scheduled after crash 1 in 150ms");
  });

  test("redis loss triggers restart flow", async () => {
    const result = await runScenario("redis");
    expect(result.stdout).toContain("restart scheduled after crash 1 in 150ms");
  });

  test("vector DB unavailability surfaces restart signal", async () => {
    const result = await runScenario("vector");
    expect(result.stderr).toContain("Vector DB unavailable");
    expect(result.stdout).toContain("restart scheduled after crash 1 in 150ms");
  });
});
