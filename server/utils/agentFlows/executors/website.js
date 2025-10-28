const { CollectorApi } = require("../../collectorApi");
const Cheerio = require("cheerio");

const WEBSITE_ACTIONS = {
  READ: "read",
  CLICK: "click",
  TYPE: "type",
};

/**
 * Execute a website interaction flow step
 * @param {Object} config Flow step configuration
 * @param {Object} context Execution context with introspect/logger helpers
 * @returns {Promise<Object>} Result of the website action
 */
async function executeWebsite(config, context) {
  const { url, selector, action = WEBSITE_ACTIONS.READ, value } = config;
  const { introspect, logger } = context;
  const normalizedAction = String(action || WEBSITE_ACTIONS.READ).toLowerCase();

  logger(
    "\x1b[43m[AgentFlowToolExecutor]\x1b[0m - executing Website block"
  );

  if (!url?.trim()) {
    throw new Error("URL is required for website interactions");
  }

  introspect(`Preparing to ${normalizedAction} on ${url}`);

  if (normalizedAction === WEBSITE_ACTIONS.READ) {
    const captureMode = selector?.trim() ? "html" : "text";

    try {
      const { success, content } = await new CollectorApi().getLinkContent(
        url,
        captureMode
      );

      if (!success) {
        throw new Error("Website content could not be retrieved");
      }

      if (!selector?.trim()) {
        introspect(`Fetched content from ${url}`);
        return {
          action: WEBSITE_ACTIONS.READ,
          url,
          selector: null,
          content: content || "",
        };
      }

      const $ = Cheerio.load(content || "");
      const elements = $(selector);
      if (elements.length === 0) {
        throw new Error(`No elements matched selector: ${selector}`);
      }

      const extractedText = elements
        .map((_, element) => $(element).text().trim())
        .get()
        .filter(Boolean)
        .join("\n");

      const extractedContent =
        extractedText ||
        elements
          .map((_, element) => $(element).html())
          .get()
          .join("\n");

      introspect(`Extracted content using selector ${selector}`);
      return {
        action: WEBSITE_ACTIONS.READ,
        url,
        selector,
        content: extractedContent || "",
      };
    } catch (error) {
      throw new Error(`Website read failed: ${error.message}`);
    }
  }

  if (!selector?.trim()) {
    throw new Error(
      `A CSS selector is required to perform a ${normalizedAction} action`
    );
  }

  if (normalizedAction === WEBSITE_ACTIONS.CLICK) {
    introspect(`Recording click action on ${selector}`);
    return {
      action: WEBSITE_ACTIONS.CLICK,
      url,
      selector,
      status: "pending",
      message: `Click ${selector} on ${url}`,
    };
  }

  if (normalizedAction === WEBSITE_ACTIONS.TYPE) {
    if (!value?.trim()) {
      throw new Error("A value is required for type actions");
    }

    introspect(`Recording type action on ${selector}`);
    return {
      action: WEBSITE_ACTIONS.TYPE,
      url,
      selector,
      value,
      status: "pending",
      message: `Type into ${selector} on ${url}`,
    };
  }

  throw new Error(`Unsupported website action: ${action}`);
}

module.exports = executeWebsite;
