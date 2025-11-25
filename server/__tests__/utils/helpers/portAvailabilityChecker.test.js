jest.mock("os", () => ({ networkInterfaces: jest.fn() }));
jest.mock("net", () => ({ createServer: jest.fn() }));

const os = require("os");
const net = require("net");

const loadModule = () => {
  delete require.cache[require.resolve("../../../utils/helpers/portAvailabilityChecker")];
  return require("../../../utils/helpers/portAvailabilityChecker");
};

describe("portAvailabilityChecker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getLocalHosts includes defaults and interface addresses", () => {
    os.networkInterfaces.mockReturnValue({
      lo: [
        { address: "127.0.0.1" },
        { address: "::1" },
      ],
      eth0: [{ address: "10.0.0.5" }],
    });

    const { getLocalHosts } = loadModule();
    const hosts = getLocalHosts();
    expect(hosts).toEqual(
      expect.arrayContaining([undefined, "0.0.0.0", "127.0.0.1", "::1", "10.0.0.5"])
    );
  });

  test("isPortInUse resolves true when socket binds successfully", async () => {
    net.createServer.mockReturnValue({
      unref: jest.fn(),
      on: jest.fn(),
      listen: jest.fn((opts, cb) => cb()),
      close: jest.fn((cb) => cb()),
    });

    const { isPortInUse } = loadModule();
    await expect(isPortInUse(1234, "127.0.0.1")).resolves.toBe(true);
    expect(net.createServer).toHaveBeenCalled();
  });

  test("isPortInUse resolves false when socket emits availability error", async () => {
    let errorHandler;
    net.createServer.mockReturnValue({
      unref: jest.fn(),
      on: jest.fn((event, handler) => {
        if (event === "error") errorHandler = handler;
      }),
      listen: jest.fn(() => {
        const err = new Error("address not available");
        err.code = "EADDRNOTAVAIL";
        errorHandler(err);
      }),
      close: jest.fn(),
    });

    const { isPortInUse } = loadModule();
    await expect(isPortInUse(5678, "badhost")).resolves.toBe(false);
  });
});
