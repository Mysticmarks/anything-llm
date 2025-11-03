process.env.NODE_ENV = process.env.NODE_ENV || "test";

if (process.env.ENABLE_TEST_REDIS !== "true") {
  process.env.REDIS_DISABLED = "true";
}
