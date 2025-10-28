let mockSchedulerShouldSucceed = true;
let mockEventsShouldSucceed = true;

const mockAdd = jest.fn();
const mockGetWorkers = jest.fn().mockResolvedValue([]);
const mockGetJobCounts = jest.fn().mockResolvedValue({});

jest.mock("bullmq", () => {
  const Queue = jest.fn().mockImplementation(() => ({
    add: mockAdd,
    getWorkers: mockGetWorkers,
    getJobCounts: mockGetJobCounts,
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

jest.mock("../../../utils/queues/connection", () => ({
  ensureConnection: jest.fn().mockResolvedValue(true),
  getConnection: jest.fn().mockReturnValue({}),
}));

function loadQueueModule() {
  let module;
  jest.isolateModules(() => {
    module = require("../../../utils/queues/embedQueue");
  });
  return module;
}

describe("embedQueue scheduler", () => {
  beforeEach(() => {
    mockSchedulerShouldSucceed = true;
    mockEventsShouldSucceed = true;
    mockAdd.mockClear();
    mockGetWorkers.mockClear();
    mockGetJobCounts.mockClear();
    const { Queue, QueueEvents, QueueScheduler } = require("bullmq");
    Queue.mockClear();
    QueueEvents.mockClear();
    QueueScheduler.mockClear();
  });

  it("initializes the queue scheduler before processing jobs", async () => {
    const { enqueueEmbeddingJob, getQueueScheduler } = loadQueueModule();

    await enqueueEmbeddingJob({ id: "doc" });

    const { QueueScheduler } = require("bullmq");
    expect(QueueScheduler).toHaveBeenCalledTimes(1);
    const schedulerInstance = QueueScheduler.mock.results[0].value;
    expect(schedulerInstance.waitUntilReady).toHaveBeenCalledTimes(1);

    const scheduler = await getQueueScheduler();
    expect(scheduler).toBe(schedulerInstance);
    expect(mockAdd).toHaveBeenCalledWith("embed-documents", { id: "doc" }, {});
  });

  it("prevents job dispatch when the scheduler fails to initialize", async () => {
    mockSchedulerShouldSucceed = false;
    const { enqueueEmbeddingJob, getQueueScheduler } = loadQueueModule();

    const result = await enqueueEmbeddingJob({ id: "doc" });

    expect(result).toBeNull();
    expect(mockAdd).not.toHaveBeenCalled();
    const { QueueScheduler } = require("bullmq");
    const schedulerInstance = QueueScheduler.mock.results[0].value;
    expect(schedulerInstance.waitUntilReady).toHaveBeenCalledTimes(1);
    expect(await getQueueScheduler()).toBeNull();
  });
});
