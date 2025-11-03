const fs = require("fs/promises");
const { constants: fsConstants } = require("fs");
const path = require("path");
const { ensureConnection, redisUrl } = require("./queue/connection");

const LOG_PREFIX = "\x1b[36m[CollectorDiagnostics]\x1b[0m";
const WARN_PREFIX = "\x1b[33m[CollectorDiagnostics]\x1b[0m";
const ERROR_PREFIX = "\x1b[31m[CollectorDiagnostics]\x1b[0m";

async function ensureWritableDirectory(dirPath, label, warnings) {
  try {
    await fs.access(dirPath, fsConstants.R_OK | fsConstants.W_OK);
  } catch (error) {
    warnings.push(
      `${label} directory ${dirPath} is not accessible (${error.code || error.message}).`
    );
  }
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

async function runCollectorStartupDiagnostics() {
  console.log(`${LOG_PREFIX} Running collector startup diagnostics...`);
  const errors = [];
  const warnings = [];

  await validateRedis(errors);

  const hotdir = path.resolve(__dirname, "../hotdir");
  const outputsDir = path.resolve(__dirname, "../outputs");

  await ensureWritableDirectory(hotdir, "Hot directory", warnings);
  await ensureWritableDirectory(outputsDir, "Outputs", warnings);

  for (const warning of warnings) {
    console.warn(`${WARN_PREFIX} ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`${ERROR_PREFIX} ${error}`);
    }
    const failure = new Error(
      `Collector diagnostics failed with ${errors.length} error${errors.length === 1 ? "" : "s"}.`
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

module.exports = { runCollectorStartupDiagnostics };
