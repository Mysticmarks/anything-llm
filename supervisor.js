const os = require("os");
const cluster = require("cluster");

const getCpuCount = () => {
  if (typeof os.availableParallelism === "function") {
    try {
      return Math.max(1, os.availableParallelism());
    } catch (_error) {
      // Fallback to os.cpus if availableParallelism throws.
    }
  }

  const cpus = os.cpus?.();
  if (Array.isArray(cpus) && cpus.length > 0) return cpus.length;
  return 1;
};

const CPU_COUNT = getCpuCount();
const DEFAULT_WORKER_TARGET = Math.max(1, CPU_COUNT - 1);
const DEFAULT_RESTART_DELAY = 5000;

const parseBoolean = (value) => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
};

const parsePositiveInteger = (value) => {
  if (value === undefined || value === null) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

module.exports = (service = "") => {
  const prefix = service ? `${service.toUpperCase()}_` : "";

  const workerTarget =
    parsePositiveInteger(process.env[`${prefix}SUPERVISOR_WORKERS`]) ??
    parsePositiveInteger(process.env.SUPERVISOR_WORKERS) ??
    DEFAULT_WORKER_TARGET;

  const restartDelay =
    parsePositiveInteger(
      process.env[`${prefix}SUPERVISOR_RESTART_DELAY_MS`]
    ) ??
    parsePositiveInteger(process.env.SUPERVISOR_RESTART_DELAY_MS) ??
    DEFAULT_RESTART_DELAY;

  const shouldSupervise =
    parseBoolean(process.env[`${prefix}SHOULD_SUPERVISE`]) ??
    parseBoolean(process.env.SHOULD_SUPERVISE) ??
    false;

  return {
    cluster,
    workerTarget,
    restartDelay,
    SHOULD_SUPERVISE: shouldSupervise,
  };
};

module.exports.DEFAULT_WORKER_TARGET = DEFAULT_WORKER_TARGET;
module.exports.DEFAULT_RESTART_DELAY = DEFAULT_RESTART_DELAY;
