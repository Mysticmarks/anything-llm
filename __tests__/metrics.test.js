const {
  setQueueMetrics,
  recordQueueDuration,
  setCircuitState,
  getPrometheusMetrics,
} = require("../server/utils/metrics/registry");

const { CircuitBreaker } = require("../server/utils/concurrency/circuitBreaker");

describe("Prometheus scraping", () => {
  test("exports queue latency, saturation, and circuit error budgets", async () => {
    setQueueMetrics("chat", { concurrency: 2, pending: 3, active: 1 });
    setQueueMetrics("ingestion", { concurrency: 4, pending: 0, active: 2 });

    recordQueueDuration("chat", 120);
    recordQueueDuration("chat", 80);
    recordQueueDuration("ingestion", 45);

    const breaker = new CircuitBreaker({
      name: "vector",
      failureThreshold: 2,
      cooldownPeriod: 100,
      successThreshold: 1,
      onStateChange: (state, _previous, circuit) =>
        setCircuitState("vector", state, circuit.snapshot()),
    });

    await expect(breaker.exec(() => Promise.reject(new Error("vector down"))))
      .rejects.toThrow("vector down");
    await expect(breaker.exec(() => Promise.reject(new Error("vector still down"))))
      .rejects.toThrow("vector still down");

    const metrics = await getPrometheusMetrics();

    expect(metrics).toContain('anything_queue_pending{queue="chat"} 3');
    expect(metrics).toContain('anything_queue_saturation_total{queue="chat"} 1');
    expect(metrics).toContain('anything_queue_duration_avg_ms{queue="chat"} 100');
    expect(metrics).toContain('anything_queue_duration_max_ms{queue="chat"} 120');

    expect(metrics).toContain('anything_circuit_state{circuit="vector"} 2');
    expect(metrics).toContain(
      'anything_circuit_error_budget_remaining{circuit="vector"} 0'
    );
    expect(metrics).toContain('anything_circuit_cooldown_ms{circuit="vector"} 100');
  });
});
