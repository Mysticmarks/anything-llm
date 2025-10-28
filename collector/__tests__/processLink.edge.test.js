jest.mock("../utils/url", () => ({
  validateURL: jest.fn((url) => url && url.trim()),
  validURL: jest.fn(() => true),
}));

jest.mock("../processLink/convert/generic", () => ({
  scrapeGenericUrl: jest.fn(),
}));

const { validateURL, validURL } = require("../utils/url");
const { scrapeGenericUrl } = require("../processLink/convert/generic");
const { processLink, getLinkText } = require("../processLink");

describe("collector link ingestion edge cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rejects invalid URLs before scraping", async () => {
    validURL.mockReturnValueOnce(false);

    const result = await processLink("javascript:alert('xss')");

    expect(validateURL).toHaveBeenCalledWith("javascript:alert('xss')");
    expect(result).toEqual({ success: false, reason: "Not a valid URL." });
    expect(scrapeGenericUrl).not.toHaveBeenCalled();
  });

  test("passes metadata and headers through to scraper", async () => {
    validURL.mockReturnValue(true);
    scrapeGenericUrl.mockResolvedValueOnce({ success: true, content: "Mock body" });

    const headers = { "x-release": "checklist" };
    const metadata = { workspaceId: 42 };
    const result = await processLink("https://example.com/doc", headers, metadata);

    expect(scrapeGenericUrl).toHaveBeenCalledWith({
      link: "https://example.com/doc",
      captureAs: "text",
      scraperHeaders: headers,
      metadata,
      saveAsDocument: true,
    });
    expect(result).toEqual({ success: true, content: "Mock body" });
  });

  test("supports text-only retrieval without document save", async () => {
    validURL.mockReturnValue(true);
    scrapeGenericUrl.mockResolvedValueOnce({ success: true, content: "Snippet" });

    const result = await getLinkText("https://example.com/reports", "html");

    expect(scrapeGenericUrl).toHaveBeenCalledWith({
      link: "https://example.com/reports",
      captureAs: "html",
      saveAsDocument: false,
    });
    expect(result).toEqual({ success: true, content: "Snippet" });
  });
});
