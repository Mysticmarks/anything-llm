import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const coverageDir = path.join(repoRoot, "coverage");
const coverageSummaryPath = path.join(coverageDir, "coverage-summary.json");

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const jestArgs = [
  "jest",
  "--coverage",
  "--coverageReporters=json-summary",
  "--coverageReporters=text",
];

const coverageThresholds = {
  statements: 0.8,
  branches: 0.75,
  functions: 0.75,
  lines: 0.8,
};

const result = spawnSync(npx, jestArgs, {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "test",
  },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!fs.existsSync(coverageSummaryPath)) {
  console.error(
    "Coverage summary not found. Ensure Jest executed with json-summary reporter."
  );
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(coverageSummaryPath, "utf8"));
const totals = summary.total;

const failures = Object.entries(coverageThresholds)
  .map(([metric, minimum]) => {
    const ratio = totals?.[metric]?.pct ? totals[metric].pct / 100 : 0;
    const pass = ratio >= minimum;
    return {
      metric,
      pass,
      actual: totals?.[metric]?.pct ?? 0,
      minimum: minimum * 100,
    };
  })
  .filter((entry) => !entry.pass);

if (failures.length > 0) {
  console.error("Coverage requirements not met:");
  for (const failure of failures) {
    console.error(
      `  ${failure.metric}: ${failure.actual.toFixed(2)}% (required ${failure.minimum.toFixed(
        2
      )}%)`
    );
  }
  process.exit(1);
}

console.log("All coverage thresholds satisfied.");
