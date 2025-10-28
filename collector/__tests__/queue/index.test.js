let mockSchedulerShouldSucceed = true;
let mockEventsShouldSucceed = true;

const mockAdd = jest.fn();

jest.mock("bullmq", () => {
  const Queue = jest.fn().mockImplementation(() => ({
    add: mockAdd,
  }));
  const QueueEvents = jest.fn().mockImplementation(() => ({
    waitUntilReady: jest.fn(() =>
      mockEventsShouldSucceed
        ? Promise.resolve()
        : Promise.reject(new Error("events failed"))
    ),
    on: jest.fn(),
  }));
  const QueueScheduler = jest.fn().mockImplementation(() => ({
    waitUntilReady: jest.fn(() =>
      mockSchedulerShouldSucceed
        ? Promise.resolve()
        : Promise.reject(new Error("scheduler failed"))
    ),
    on: jest.fn(),
  }));
  return { Queue, QueueEvents, QueueScheduler };
}, { virtual: true });

jest.mock("../../utils/queue/connection", () => ({
  ensureConnection: jest.fn().mockResolvedValue(true),
  getConnection: jest.fn().mockReturnValue({}),
}));

function loadQueueModule() {
  let module;
  jest.isolateModules(() => {
    module = require("../../utils/queue/index");
  });
  return module;
}

describe("collector processing queue", () => {
  beforeEach(() => {
    mockSchedulerShouldSucceed = true;
    mockEventsShouldSucceed = true;
    mockAdd.mockClear();
    const { Queue, QueueEvents, QueueScheduler } = require("bullmq");
    Queue.mockClear();
    QueueEvents.mockClear();
    QueueScheduler.mockClear();
  });

  it("starts the scheduler before allowing jobs", async () => {
    const { enqueueProcessingJob, getQueueScheduler } = loadQueueModule();

    await enqueueProcessingJob("collect", { url: "https://docs" });

    const { QueueScheduler } = require("bullmq");
    expect(QueueScheduler).toHaveBeenCalledTimes(1);
    const schedulerInstance = QueueScheduler.mock.results[0].value;
    expect(schedulerInstance.waitUntilReady).toHaveBeenCalledTimes(1);

    const scheduler = await getQueueScheduler();
    expect(scheduler).toBe(schedulerInstance);
    expect(mockAdd).toHaveBeenCalledWith("collect", { url: "https://docs" }, {});
  });

  it("bails out when the scheduler cannot come online", async () => {
    mockSchedulerShouldSucceed = false;
    const { enqueueProcessingJob, getQueueScheduler } = loadQueueModule();

    const result = await enqueueProcessingJob("collect", { url: "https://docs" });

    expect(result).toBeNull();
    expect(mockAdd).not.toHaveBeenCalled();
    const { QueueScheduler } = require("bullmq");
    const schedulerInstance = QueueScheduler.mock.results[0].value;
    expect(schedulerInstance.waitUntilReady).toHaveBeenCalledTimes(1);
    expect(await getQueueScheduler()).toBeNull();
  });
});
