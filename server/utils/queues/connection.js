const IORedis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
let connection = null;
let ready = false;
let initializing = null;

function log(message, ...args) {
  console.log(`\x1b[36m[QueueConnection]\x1b[0m ${message}`, ...args);
}

function ensureClient() {
  if (connection) return connection;
  connection = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  connection.on("ready", () => {
    ready = true;
    log(`Connected to ${redisUrl}`);
  });
  connection.on("error", (error) => {
    ready = false;
    console.error(
      `\x1b[31m[QueueConnection]\x1b[0m ${error?.message || error}`
    );
  });
  return connection;
}

async function ensureConnection() {
  ensureClient();
  if (ready) return true;
  if (initializing) return initializing;

  initializing = connection
    .connect()
    .then(() => true)
    .catch((error) => {
      console.warn(
        `\x1b[33m[QueueConnection]\x1b[0m Failed to connect to Redis at ${redisUrl}: ${error?.message}`
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

function isConnectionReady() {
  return ready;
}

module.exports = {
  ensureConnection,
  getConnection,
  isConnectionReady,
  redisUrl,
};
