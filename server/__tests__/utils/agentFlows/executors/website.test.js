const mockGetLinkContent = jest.fn();

jest.mock("../../../../utils/collectorApi", () => ({
  CollectorApi: jest.fn().mockImplementation(() => ({
    getLinkContent: mockGetLinkContent,
  })),
}));
const executeWebsite = require("../../../../utils/agentFlows/executors/website");

const baseContext = {
  introspect: jest.fn(),
  logger: jest.fn(),
};

describe("executeWebsite", () => {
  beforeEach(() => {
    mockGetLinkContent.mockReset();
    baseContext.introspect.mockClear();
    baseContext.logger.mockClear();
  });

  it("returns page content when reading without selector", async () => {
    mockGetLinkContent.mockResolvedValue({ success: true, content: "hello" });

    const result = await executeWebsite(
      { url: "https://example.com", action: "read" },
      baseContext
    );

    expect(mockGetLinkContent).toHaveBeenCalledWith(
      "https://example.com",
      "text"
    );
    expect(result).toEqual({
      action: "read",
      url: "https://example.com",
      selector: null,
      content: "hello",
    });
  });

  it("extracts content using a selector", async () => {
    mockGetLinkContent.mockResolvedValue({
      success: true,
      content: '<div class="target">Value</div>',
    });

    const result = await executeWebsite(
      {
        url: "https://example.com",
        action: "read",
        selector: ".target",
      },
      baseContext
    );

    expect(mockGetLinkContent).toHaveBeenCalledWith(
      "https://example.com",
      "html"
    );
    expect(result.content).toBe("Value");
  });

  it("throws when selector missing for click", async () => {
    await expect(
      executeWebsite(
        { url: "https://example.com", action: "click" },
        baseContext
      )
    ).rejects.toThrow(/selector is required/i);
  });

  it("returns action object for typing", async () => {
    const result = await executeWebsite(
      {
        url: "https://example.com",
        action: "type",
        selector: "#input",
        value: "hello",
      },
      baseContext
    );

    expect(result).toEqual({
      action: "type",
      url: "https://example.com",
      selector: "#input",
      value: "hello",
      status: "pending",
      message: "Type into #input on https://example.com",
    });
  });
});
