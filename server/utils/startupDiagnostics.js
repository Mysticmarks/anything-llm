const fs = require("fs/promises");
const { constants: fsConstants } = require("fs");
const path = require("path");
const { ensureConnection, redisUrl } = require("./queues/connection");
const { getVectorDbClass } = require("./helpers");

const LOG_PREFIX = "\x1b[36m[StartupDiagnostics]\x1b[0m";
const WARN_PREFIX = "\x1b[33m[StartupDiagnostics]\x1b[0m";
const ERROR_PREFIX = "\x1b[31m[StartupDiagnostics]\x1b[0m";

const REQUIRED_SECRETS = [
  { key: "JWT_SECRET", minimum: 12 },
  { key: "SIG_KEY", minimum: 32 },
  { key: "SIG_SALT", minimum: 32 },
];

function resolvePath(candidate) {
  if (!candidate) return null;
  if (path.isAbsolute(candidate)) return candidate;
  return path.resolve(process.cwd(), candidate);
}

async function validateHttpsArtifacts(errors, warnings) {
  if (!process.env.ENABLE_HTTPS) return;

  const certPath = resolvePath(process.env.HTTPS_CERT_PATH);
  const keyPath = resolvePath(process.env.HTTPS_KEY_PATH);

  if (!certPath || !keyPath) {
    warnings.push(
      "HTTPS is enabled but HTTPS_CERT_PATH and HTTPS_KEY_PATH are not fully configured."
    );
    return;
  }

  try {
    await fs.access(certPath, fsConstants.R_OK);
  } catch (error) {
    errors.push(`Unable to read HTTPS certificate at ${certPath}: ${error.message}`);
  }

  try {
    await fs.access(keyPath, fsConstants.R_OK);
  } catch (error) {
    errors.push(`Unable to read HTTPS key at ${keyPath}: ${error.message}`);
  }
}

async function validateStorageDirectory(warnings) {
  const storageDir = process.env.STORAGE_DIR
    ? resolvePath(process.env.STORAGE_DIR)
    : path.resolve(__dirname, "../storage");

  try {
    await fs.access(storageDir, fsConstants.R_OK | fsConstants.W_OK);
  } catch (error) {
    warnings.push(
      `Storage directory ${storageDir} is not accessible (${error.code || error.message}).`
    );
  }
}

async function validateVectorProvider(errors) {
  try {
    const VectorDb = getVectorDbClass();
    if (typeof VectorDb.heartbeat === "function") {
      await VectorDb.heartbeat();
      return;
    }

    if (typeof VectorDb.connect === "function") {
      const connection = await VectorDb.connect();
      const client = connection?.client || connection;
      if (client && typeof client.close === "function") {
        try {
          await client.close();
        } catch (_error) {
          // Ignore shutdown errors; this is only a connectivity probe.
        }
      }
      return;
    }
  } catch (error) {
    errors.push(`Vector database connectivity check failed: ${error.message}`);
    return;
  }

  errors.push("Vector database provider is missing a heartbeat or connect method.");
}

async function validateRedis(errors) {
  try {
    const ready = await ensureConnection();
    if (!ready) {
      errors.push(`Unable to connect to Redis at ${redisUrl}.`);
    }
  } catch (error) {
    errors.push(`Redis connectivity check failed: ${error.message}`);
  }
}

function validateSecrets(errors) {
  for (const { key, minimum } of REQUIRED_SECRETS) {
    const value = process.env[key];
    if (!value) {
      errors.push(`${key} is not set.`);
      continue;
    }
    if (value.length < minimum) {
      errors.push(`${key} must be at least ${minimum} characters long.`);
    }
  }
}

function validateDatabaseConfiguration(errors) {
  const vectorDb = (process.env.VECTOR_DB || "lancedb").toLowerCase();
  const databaseUrl = process.env.DATABASE_URL || "";

  if (vectorDb === "pgvector" && !databaseUrl.startsWith("postgres")) {
    errors.push("VECTOR_DB=pgvector requires a PostgreSQL DATABASE_URL.");
  }

  if (databaseUrl && !databaseUrl.startsWith("postgres") && !databaseUrl.startsWith("file:")) {
    errors.push(
      "DATABASE_URL must use the `postgres` scheme or omit to use the bundled SQLite database."
    );
  }
}

async function runStartupDiagnostics() {
  console.log(`${LOG_PREFIX} Running server startup diagnostics...`);

  const errors = [];
  const warnings = [];

  validateSecrets(errors);
  validateDatabaseConfiguration(errors);
  await validateHttpsArtifacts(errors, warnings);
  await validateStorageDirectory(warnings);
  await validateVectorProvider(errors);
  await validateRedis(errors);

  for (const warning of warnings) {
    console.warn(`${WARN_PREFIX} ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`${ERROR_PREFIX} ${error}`);
    }
    const failure = new Error(
      `Startup diagnostics failed with ${errors.length} error${errors.length === 1 ? "" : "s"}.`
    );
    failure.diagnostics = { errors, warnings };
    throw failure;
  }

  console.log(
    `${LOG_PREFIX} All diagnostics passed${
      warnings.length ? ` with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : ""
    }.`
  );
  return { errors, warnings };
}

module.exports = { runStartupDiagnostics };
