const cluster = require("cluster");

const workerTarget = Number(process.env.SERVER_SUPERVISOR_WORKERS || 1) || 1;
const restartDelay = Number(process.env.SERVER_SUPERVISOR_RESTART_DELAY_MS || 150);

function spawnWorker() {
  const worker = cluster.fork({ CHAOS_SCENARIO: process.env.CHAOS_SCENARIO || "crash" });
  worker.on("exit", (code, signal) => {
    const reason = signal ? `${signal}` : `${code ?? 0}`;
    console.warn(`[chaos] worker ${worker.process.pid} exited with ${reason}`);
  });
  return worker;
}

if (cluster.isPrimary) {
  let crashes = 0;
  for (let i = 0; i < workerTarget; i += 1) {
    spawnWorker();
  }

  cluster.on("exit", () => {
    crashes += 1;
    console.log(
      `[chaos] restart scheduled after crash ${crashes} in ${restartDelay}ms`
    );
    if (crashes >= Number(process.env.CHAOS_EXPECTED_RESTARTS || 1)) {
      setTimeout(() => process.exit(0), restartDelay + 25);
    }
    setTimeout(spawnWorker, restartDelay);
  });

  setTimeout(() => process.exit(0), Number(process.env.CHAOS_MAX_DURATION_MS || 2000));
} else {
  const scenario = process.env.CHAOS_SCENARIO || "crash";
  if (scenario === "redis") {
    const IORedis = require("ioredis");
    const client = new IORedis("redis://127.0.0.1:65534", {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    client.on("error", () => process.exit(1));
    client.connect().catch(() => process.exit(1));
    setTimeout(() => process.exit(1), 200);
  } else if (scenario === "vector") {
    setTimeout(() => {
      console.error("Vector DB unavailable");
      process.exit(1);
    }, 100);
  } else {
    setTimeout(() => process.exit(1), 100);
  }
}
