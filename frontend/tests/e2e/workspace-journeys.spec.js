const { test, expect } = require("@playwright/test");

async function stubApi(page, overrides = {}) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const overrideKey = Object.keys(overrides).find((key) =>
      url.includes(key)
    );
    if (overrideKey) {
      await overrides[overrideKey](route);
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
}

test.describe("Core workspace journeys", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\.(png|jpg|webp|svg|gif)$/i, (route) =>
      route.fulfill({ status: 200, body: "" })
    );
  });

  test("allows workspace creation during onboarding", async ({ page }) => {
    await stubApi(page, {
      "/api/setup-complete": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: {
              MultiUserMode: false,
              RequiresAuth: false,
              LLMProvider: "openai",
              VectorDB: "lancedb",
            },
          }),
        }),
      "/api/workspaces": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ workspaces: [] }),
        }),
      "/api/workspace/new": async (route) => {
        const payload = route.request().postDataJSON();
        expect(payload).toMatchObject({
          name: "Playwright Space",
          onboardingComplete: true,
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            workspace: {
              slug: "playwright-space",
              name: "Playwright Space",
            },
            message: "created",
          }),
        });
      },
    });

    await page.goto("/onboarding/create-workspace");
    await page.fill('input[name="name"]', "Playwright Space");
    await page.keyboard.press("Enter");

    await expect(
      page.getByText("Workspace created successfully!", { exact: false })
    ).toBeVisible();
    await page.waitForURL("**/");
  });

  test("streams responses when sending a prompt", async ({ page }) => {
    await stubApi(page, {
      "/api/setup-complete": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: {
              MultiUserMode: false,
              RequiresAuth: false,
              LLMProvider: "openai",
              VectorDB: "lancedb",
            },
          }),
        }),
      "/api/workspace/demo": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            workspace: {
              id: 1,
              slug: "demo",
              name: "Demo Workspace",
            },
          }),
        }),
      "/api/workspace/demo/suggested-messages": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ suggestedMessages: [] }),
        }),
      "/api/workspace/demo/pfp": (route) =>
        route.fulfill({ status: 204, body: "" }),
      "/api/workspace/demo/chats": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ history: [] }),
        }),
      "stream-chat": (route) =>
        route.fulfill({
          status: 200,
          headers: { "content-type": "text/event-stream" },
          body:
            `data: ${JSON.stringify({
              uuid: "stream-1",
              type: "textResponseChunk",
              textResponse: "Mock assistant reply",
              close: false,
              sources: [],
            })}\n\n` +
            `data: ${JSON.stringify({
              uuid: "stream-1",
              type: "textResponseChunk",
              textResponse: "!",
              close: true,
              sources: [],
            })}\n\n`,
        }),
    });

    await page.goto("/workspace/demo");
    const promptInput = page.locator("textarea#primary-prompt-input");
    await promptInput.fill("Hello world");
    await page.getByLabel("Send").click();

    await expect(page.getByText("Mock assistant reply!", { exact: false }))
      .toBeVisible();
  });

  test("agent selection seeds prompt and streams status", async ({ page }) => {
    await stubApi(page, {
      "/api/setup-complete": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: {
              MultiUserMode: false,
              RequiresAuth: false,
              LLMProvider: "openai",
              VectorDB: "lancedb",
            },
          }),
        }),
      "/api/workspace/demo": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            workspace: {
              id: 1,
              slug: "demo",
              name: "Demo Workspace",
            },
          }),
        }),
      "/api/workspace/demo/suggested-messages": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ suggestedMessages: [] }),
        }),
      "/api/workspace/demo/pfp": (route) =>
        route.fulfill({ status: 204, body: "" }),
      "/api/workspace/demo/chats": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ history: [] }),
        }),
      "stream-chat": (route) =>
        route.fulfill({
          status: 200,
          headers: { "content-type": "text/event-stream" },
          body:
            `data: ${JSON.stringify({
              uuid: "agent-stream",
              type: "statusResponse",
              textResponse: "Agent is thinking...",
              close: true,
              sources: [],
            })}\n\n`,
        }),
    });

    await page.goto("/workspace/demo?action=set-agent-chat");
    await expect(
      page.getByRole("button", { name: /@agent/i })
    ).toBeVisible();
    await page.getByRole("button", { name: /@agent/i }).click();

    const promptInput = page.locator("textarea#primary-prompt-input");
    await expect(promptInput).toHaveValue("@agent ");

    await promptInput.type("Summarize the document");
    await page.getByLabel("Send").click();

    await expect(page.getByText("Agent is thinking", { exact: false }))
      .toBeVisible();
  });
});
