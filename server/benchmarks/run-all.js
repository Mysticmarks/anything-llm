const { spawn } = require("child_process");
const path = require("path");

const scripts = ["chat.js", "ingestion.js", "agent.js"];

async function runScript(script) {
  const scriptPath = path.join(__dirname, script);
  console.log(`\n▶ Running ${script}`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${script} exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

(async () => {
  for (const script of scripts) {
    await runScript(script);
  }
  console.log("\n✅ All benchmarks finished");
})().catch((error) => {
  console.error("Benchmark suite failed", error);
  process.exitCode = 1;
});
