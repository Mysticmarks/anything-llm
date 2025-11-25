class CircuitBreaker {
  constructor({
    name,
    failureThreshold = 5,
    successThreshold = 1,
    cooldownPeriod = 30000,
    onStateChange = null,
  }) {
    if (!name) throw new Error("CircuitBreaker requires a name");
    this.name = name;
    this.failureThreshold = Math.max(1, Number(failureThreshold) || 5);
    this.successThreshold = Math.max(1, Number(successThreshold) || 1);
    this.cooldownPeriod = Math.max(1000, Number(cooldownPeriod) || 30000);
    this.onStateChange = typeof onStateChange === "function" ? onStateChange : null;

    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = 0;
    this.lastError = null;
  }

  snapshot() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      lastError: this.lastError,
      failureThreshold: this.failureThreshold,
      successThreshold: this.successThreshold,
      cooldownPeriod: this.cooldownPeriod,
    };
  }

  setState(state) {
    if (this.state === state) return;
    const previous = this.state;
    this.state = state;
    if (this.onStateChange) {
      try {
        this.onStateChange(state, previous, this);
      } catch (error) {
        console.warn(
          `\\x1b[33m[CircuitBreaker:${this.name}]\\x1b[0m Failed to emit state change: ${error?.message}`
        );
      }
    }
  }

  async exec(action) {
    if (typeof action !== "function") {
      throw new TypeError("CircuitBreaker.exec expects a function");
    }

    if (this.state === "open") {
      if (Date.now() > this.nextAttempt) {
        this.setState("half_open");
      } else {
        const error = new Error("Circuit breaker is open");
        error.code = "CIRCUIT_OPEN";
        throw error;
      }
    }

    try {
      const result = await action();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }

  recordSuccess() {
    if (this.state === "half_open") {
      this.successCount += 1;
      if (this.successCount >= this.successThreshold) {
        this.successCount = 0;
        this.failureCount = 0;
        this.setState("closed");
      }
    } else {
      this.failureCount = 0;
      this.successCount = 0;
    }
  }

  recordFailure(error) {
    this.failureCount += 1;
    this.lastError = error?.message || String(error);

    if (this.state === "half_open" || this.failureCount >= this.failureThreshold) {
      this.trip();
    }
  }

  trip() {
    this.setState("open");
    this.nextAttempt = Date.now() + this.cooldownPeriod;
    this.successCount = 0;
  }

  reset() {
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = 0;
    this.setState("closed");
  }
}

module.exports = { CircuitBreaker };
