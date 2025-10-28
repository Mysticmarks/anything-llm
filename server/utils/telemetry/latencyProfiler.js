const { EventEmitter } = require("events");
const crypto = require("crypto");

const spans = [];
const MAX_SPANS = Math.max(
  100,
  Number(process.env.TELEMETRY_MAX_SPANS || 2000)
);
const profilerEmitter = new EventEmitter();

function recordSpan(span) {
  spans.push(span);
  if (spans.length > MAX_SPANS) {
    spans.splice(0, spans.length - MAX_SPANS);
  }
  profilerEmitter.emit("span", span);
  return span;
}

function startSpan(name, metadata = {}) {
  const start = process.hrtime.bigint();
  let ended = false;
  const contextId = crypto.randomUUID();
  return {
    id: contextId,
    end(extra = {}) {
      if (ended) return null;
      ended = true;
      const stop = process.hrtime.bigint();
      const durationMs = Number(stop - start) / 1_000_000;
      const span = {
        id: contextId,
        name,
        durationMs,
        timestamp: Date.now(),
        metadata: { ...metadata, ...extra },
      };
      return recordSpan(span);
    },
  };
}

function addSpan(name, durationMs, metadata = {}) {
  return recordSpan({
    id: crypto.randomUUID(),
    name,
    durationMs,
    timestamp: Date.now(),
    metadata: { ...metadata },
  });
}

function getSpans({ name = null, since = null } = {}) {
  return spans.filter((span) => {
    if (name && span.name !== name) return false;
    if (since && span.timestamp < since) return false;
    return true;
  });
}

function percentile(sortedDurations, percentile) {
  if (!sortedDurations.length) return 0;
  if (sortedDurations.length === 1) return sortedDurations[0];
  const idx = (sortedDurations.length - 1) * percentile;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedDurations[lower];
  const weight = idx - lower;
  return (
    sortedDurations[lower] * (1 - weight) + sortedDurations[upper] * weight
  );
}

function summarize({ since = null } = {}) {
  const relevantSpans = getSpans({ since });
  const summary = {};
  for (const span of relevantSpans) {
    if (!summary[span.name]) {
      summary[span.name] = {
        name: span.name,
        count: 0,
        totalDurationMs: 0,
        minDurationMs: Number.POSITIVE_INFINITY,
        maxDurationMs: 0,
        durations: [],
      };
    }
    const bucket = summary[span.name];
    bucket.count += 1;
    bucket.totalDurationMs += span.durationMs;
    bucket.minDurationMs = Math.min(bucket.minDurationMs, span.durationMs);
    bucket.maxDurationMs = Math.max(bucket.maxDurationMs, span.durationMs);
    bucket.durations.push(span.durationMs);
  }

  return Object.values(summary).map((bucket) => {
    const sorted = bucket.durations.sort((a, b) => a - b);
    const average = bucket.totalDurationMs / Math.max(bucket.count, 1);
    const median = percentile(sorted, 0.5);
    const p95 = percentile(sorted, 0.95);
    const p99 = percentile(sorted, 0.99);
    return {
      name: bucket.name,
      count: bucket.count,
      averageDurationMs: average,
      minDurationMs:
        bucket.minDurationMs === Number.POSITIVE_INFINITY
          ? 0
          : bucket.minDurationMs,
      maxDurationMs: bucket.maxDurationMs,
      medianDurationMs: median,
      p95DurationMs: p95,
      p99DurationMs: p99,
    };
  });
}

module.exports = {
  LatencyProfiler: {
    startSpan,
    addSpan,
    getSpans,
    summarize,
    on: profilerEmitter.on.bind(profilerEmitter),
    off: profilerEmitter.off.bind(profilerEmitter),
  },
};
