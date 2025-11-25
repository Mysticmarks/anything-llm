const prismaInstance = { mock: true };

jest.mock(
  "@prisma/client",
  () => {
    const PrismaClient = jest.fn(() => prismaInstance);
    return { PrismaClient };
  },
  { virtual: true }
);

const { PrismaClient } = require("@prisma/client");

describe("prisma client factory", () => {
  beforeEach(() => {
    PrismaClient.mockClear();
    delete process.env.DATABASE_URL;
  });

  test("instantiates PrismaClient with default logging", () => {
    jest.isolateModules(() => {
      const prisma = require("../../../utils/prisma");
      expect(PrismaClient).toHaveBeenCalledWith({ log: ["error", "info", "warn"] });
      expect(PrismaClient.mock.results[0].value).toBe(prisma);
    });
  });

  test("passes DATABASE_URL through datasources configuration", () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    jest.isolateModules(() => {
      const prisma = require("../../../utils/prisma");

      expect(PrismaClient).toHaveBeenCalledWith({
        log: ["error", "info", "warn"],
        datasources: { db: { url: process.env.DATABASE_URL } },
      });
      expect(PrismaClient.mock.results[0].value).toBe(prisma);
    });
  });
});
