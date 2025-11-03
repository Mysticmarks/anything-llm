function createLimiter({
  windowMs,
  max,
  skip,
  name,
}) {
  const window = Math.max(1000, Number(windowMs) || 60000);
  const limit = Math.max(1, Number(max) || 60);
  const buckets = new Map();

  function cleanup(now) {
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.expires <= now) {
        buckets.delete(key);
      }
    }
  }

  return function limiter(request, response, next) {
    if (typeof skip === "function" && skip(request)) return next();

    const identifier = request.ip || request.headers["x-forwarded-for"] || "anon";
    const now = Date.now();
    cleanup(now);

    const bucket = buckets.get(identifier) || {
      count: 0,
      expires: now + window,
    };

    if (now > bucket.expires) {
      bucket.count = 0;
      bucket.expires = now + window;
    }

    bucket.count += 1;
    buckets.set(identifier, bucket);

    request.rateLimitInfo = {
      name,
      remaining: Math.max(0, limit - bucket.count),
      limit,
      resetTime: new Date(bucket.expires),
    };

    if (bucket.count > limit) {
      const retryAfter = Math.ceil((bucket.expires - now) / 1000);
      response.setHeader("Retry-After", retryAfter);
      response.status(429).json({
        success: false,
        error: "Too many requests. Please retry later.",
      });
      return;
    }

    next();
  };
}

const baseLimiter = createLimiter({
  name: "base",
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60000) || 60000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 600) || 600,
  skip: (request) => {
    if (request.method !== "GET") return false;
    const path = request.path || "";
    return (
      path === "/health" ||
      path.startsWith("/health/") ||
      path.startsWith("/metrics")
    );
  },
});

const chatLimiter = createLimiter({
  name: "chat",
  windowMs: Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS || 60000) || 60000,
  max: Number(process.env.CHAT_RATE_LIMIT_MAX || 60) || 60,
});

const ingestionLimiter = createLimiter({
  name: "ingestion",
  windowMs: Number(process.env.INGESTION_RATE_LIMIT_WINDOW_MS || 60000) || 60000,
  max: Number(process.env.INGESTION_RATE_LIMIT_MAX || 30) || 30,
});

const agentLimiter = createLimiter({
  name: "agent",
  windowMs: Number(process.env.AGENT_RATE_LIMIT_WINDOW_MS || 60000) || 60000,
  max: Number(process.env.AGENT_RATE_LIMIT_MAX || 45) || 45,
});

module.exports = {
  baseLimiter,
  chatLimiter,
  ingestionLimiter,
  agentLimiter,
};
