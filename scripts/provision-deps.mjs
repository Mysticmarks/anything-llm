import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let loadEnv = () => ({ parsed: {} });
try {
  ({ config: loadEnv } = await import("dotenv"));
} catch {
  console.warn(
    "\x1b[33m[provision-deps]\x1b[0m Optional dependency 'dotenv' not found; continuing without loading additional env files."
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const envCandidates = [
  path.resolve(repoRoot, ".env"),
  path.resolve(repoRoot, "docker/.env"),
  path.resolve(repoRoot, "server/.env"),
  path.resolve(repoRoot, `server/.env.${process.env.NODE_ENV || "development"}`),
  path.resolve(repoRoot, "collector/.env"),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
}

const composeFile = path.resolve(repoRoot, "docker/dependencies.compose.yml");
if (!fs.existsSync(composeFile)) {
  console.error(
    "\x1b[31m[provision-deps]\x1b[0m Unable to locate docker/dependencies.compose.yml"
  );
  process.exit(1);
}

function resolveComposeCommand() {
  const dockerResult = spawnSync("docker", ["compose", "version"], {
    stdio: "ignore",
  });
  if (dockerResult.status === 0) {
    return { command: "docker", baseArgs: ["compose"] };
  }

  const legacyResult = spawnSync("docker-compose", ["version"], {
    stdio: "ignore",
  });
  if (legacyResult.status === 0) {
    return { command: "docker-compose", baseArgs: [] };
  }

  console.error(
    "\x1b[31m[provision-deps]\x1b[0m Docker Compose is required to provision dependencies."
  );
  process.exit(1);
}

const { command, baseArgs } = resolveComposeCommand();

const cliFlags = new Set(process.argv.slice(2));
const services = new Set(["redis"]);
const vectorDb = (process.env.VECTOR_DB || "").toLowerCase();
const databaseUrl = process.env.DATABASE_URL || "";

if (vectorDb === "pgvector" || databaseUrl.startsWith("postgres")) {
  services.add("postgres");
}
if (vectorDb === "qdrant" || cliFlags.has("--with-qdrant")) {
  services.add("qdrant");
}
if (vectorDb === "chroma" || vectorDb === "chromadb" || cliFlags.has("--with-chroma")) {
  services.add("chroma");
}
if (cliFlags.has("--with-postgres")) {
  services.add("postgres");
}

const args = [...baseArgs, "-f", composeFile, "up", "-d", ...services];
console.log(
  `\x1b[36m[provision-deps]\x1b[0m Launching services: ${Array.from(services).join(", ")}`
);
const result = spawnSync(command, args, { stdio: "inherit" });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("\x1b[32m[provision-deps]\x1b[0m Dependencies are running.");
console.log(
  "\x1b[36m[provision-deps]\x1b[0m Use `docker compose -f docker/dependencies.compose.yml ps` to inspect container health."
);
