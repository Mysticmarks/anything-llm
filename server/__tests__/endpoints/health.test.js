const express = require("express");

jest.mock("../../utils/prisma", () => ({
  $queryRaw: jest.fn(),
}));

const prisma = require("../../utils/prisma");
const {
  healthEndpoints,
  handleHealthCheck,
} = require("../../endpoints/health");

const buildResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("health endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("healthEndpoints registers GET /health", () => {
    const router = express.Router();
    healthEndpoints(router);

    const layer = router.stack.find(
      (item) => item.route && item.route.path === "/health"
    );

    expect(layer).toBeDefined();
    expect(layer.route.methods.get).toBe(true);
  });

  test("handleHealthCheck returns ok when database responds", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ ok: 1 }]);
    const res = buildResponse();

    await handleHealthCheck({}, res);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);

    const payload = res.json.mock.calls[0][0];
    expect(payload.status).toBe("ok");
    expect(payload.components.database.status).toBe("ok");
    expect(payload.timestamp).toEqual(expect.any(String));
    expect(payload.uptime).toEqual(expect.any(Number));
  });

  test("handleHealthCheck returns error when database fails", async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error("db offline"));
    const res = buildResponse();

    await handleHealthCheck({}, res);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(503);

    const payload = res.json.mock.calls[0][0];
    expect(payload.status).toBe("error");
    expect(payload.components.database.status).toBe("error");
    expect(payload.components.database.message).toBe("db offline");
  });
});
