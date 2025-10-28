const useMockRedis =
  process.env.COLLECTOR_MOCK_REDIS === "true" ||
  (process.env.REDIS_URL || "").startsWith("mock://");

const IORedis = useMockRedis ? require("ioredis-mock") : require("ioredis");

const redisUrl = useMockRedis
  ? process.env.REDIS_URL || "mock://local"
  : process.env.REDIS_URL || "redis://127.0.0.1:6379";
let connection = null;
let ready = false;
let initializing = null;

function ensureClient() {
  if (connection) return connection;
  if (useMockRedis) {
    connection = new IORedis();
    ready = true;
    console.log(
      "\x1b[36m[CollectorQueue]\x1b[0m Using in-memory Redis mock for tests"
    );
    return connection;
  }

  connection = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  connection.on("ready", () => {
    ready = true;
    console.log(
      `\x1b[36m[CollectorQueue]\x1b[0m Connected to ${redisUrl}`
    );
  });
  connection.on("error", (error) => {
    ready = false;
    console.error(
      `\x1b[31m[CollectorQueue]\x1b[0m ${error?.message || error}`
    );
  });
  return connection;
}

async function ensureConnection() {
  ensureClient();
  if (useMockRedis) return true;
  if (ready) return true;
  if (initializing) return initializing;

  initializing = connection
    .connect()
    .then(() => true)
    .catch((error) => {
      console.warn(
        `\x1b[33m[CollectorQueue]\x1b[0m Failed to connect to Redis at ${redisUrl}: ${error?.message}`
      );
      return false;
    })
    .finally(() => {
      initializing = null;
    });

  return initializing;
}

function getConnection() {
  ensureClient();
  return connection;
}

function isReady() {
  return ready;
}

module.exports = {
  ensureConnection,
  getConnection,
  isReady,
  redisUrl,
};
