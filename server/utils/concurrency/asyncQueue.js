const { randomUUID } = require("crypto");

class AsyncQueue {
  constructor({
    name,
    concurrency = 1,
    onUpdate = null,
    onTiming = null,
  }) {
    if (!name) throw new Error("AsyncQueue requires a name");
    this.name = name;
    this.concurrency = Math.max(1, Number(concurrency) || 1);
    this.onUpdate = typeof onUpdate === "function" ? onUpdate : null;
    this.onTiming = typeof onTiming === "function" ? onTiming : null;
    this.queue = [];
    this.active = 0;
  }

  snapshot() {
    return {
      name: this.name,
      concurrency: this.concurrency,
      pending: this.queue.length,
      active: this.active,
    };
  }

  updateMetrics() {
    if (this.onUpdate) {
      try {
        this.onUpdate(this.snapshot());
      } catch (error) {
        console.warn(
          `\\x1b[33m[AsyncQueue:${this.name}]\\x1b[0m Failed to publish metrics: ${error?.message}`
        );
      }
    }
  }

  async run(fn, options = {}) {
    if (typeof fn !== "function") {
      throw new TypeError("AsyncQueue.run expects a function");
    }

    const taskId = randomUUID();

    const task = {
      id: taskId,
      fn,
      resolve: null,
      reject: null,
      timeout: Number(options.timeout || 0) || 0,
      signal: options.signal || null,
    };

    task.promise = new Promise((resolve, reject) => {
      task.resolve = resolve;
      task.reject = reject;
    });

    if (task.timeout > 0) {
      task.timer = setTimeout(() => {
        task.timedOut = true;
        const index = this.queue.indexOf(task);
        if (index !== -1) this.queue.splice(index, 1);
        task.reject(new Error(`AsyncQueue task ${taskId} timed out`));
        this.updateMetrics();
        this.process();
      }, task.timeout);
    }

    if (task.signal) {
      if (task.signal.aborted) {
        task.reject(task.signal.reason || new Error("Task aborted"));
        return task.promise;
      }
      const abortHandler = () => {
        task.signal.removeEventListener("abort", abortHandler);
        task.aborted = true;
        const index = this.queue.indexOf(task);
        if (index !== -1) this.queue.splice(index, 1);
        task.reject(task.signal.reason || new Error("Task aborted"));
        this.updateMetrics();
        this.process();
      };
      task.signal.addEventListener("abort", abortHandler);
      task.onAbort = abortHandler;
    }

    this.queue.push(task);
    this.updateMetrics();
    this.process();

    return task.promise;
  }

  process() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) {
        this.updateMetrics();
        continue;
      }
      if (task.aborted || task.timedOut) {
        this.updateMetrics();
        continue;
      }

      this.active += 1;
      this.updateMetrics();

      const startedAt = Date.now();

      (async () => {
        try {
          const result = await task.fn();
          if (task.timedOut || task.aborted) return;
          task.resolve(result);
        } catch (error) {
          if (task.timedOut || task.aborted) return;
          task.reject(error);
        } finally {
          if (task.timer) clearTimeout(task.timer);
          if (task.onAbort && task.signal) {
            try {
              task.signal.removeEventListener("abort", task.onAbort);
            } catch (_) {
              // ignore
            }
          }
          this.active -= 1;
          this.updateMetrics();
          if (this.onTiming) {
            const duration = Date.now() - startedAt;
            try {
              this.onTiming(duration);
            } catch (error) {
              console.warn(
                `\x1b[33m[AsyncQueue:${this.name}]\x1b[0m Failed to emit timing: ${error?.message}`
              );
            }
          }
          this.process();
        }
      })();
    }
  }
}

module.exports = { AsyncQueue };
