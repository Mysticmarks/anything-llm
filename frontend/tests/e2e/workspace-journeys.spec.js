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

async function setLocalUser(page, user, token = "playwright-token") {
  await page.addInitScript((data) => {
    window.localStorage.setItem("anythingllm_user", JSON.stringify(data.user));
    window.localStorage.setItem("anythingllm_authToken", data.token);
  }, { user, token });
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

  test("recovers from agent websocket interruptions", async ({ page }) => {
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
      "/api/workspace/demo/pfp": (route) => route.fulfill({ status: 204, body: "" }),
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
              type: "agentInitWebsocketConnection",
              websocketUUID: "agent-session-1",
            })}\n\n` +
            `data: ${JSON.stringify({
              uuid: "agent-stream",
              type: "statusResponse",
              textResponse: "Agent engaged",
              close: true,
            })}\n\n`,
        }),
    });

    await page.addInitScript(() => {
      window.__mockSockets = [];
      class PlaywrightMockWebSocket {
        constructor(url) {
          this.url = url;
          this.listeners = { open: [], message: [], close: [], error: [] };
          this.readyState = PlaywrightMockWebSocket.CONNECTING;
          window.__mockSockets.push(this);
        }

        addEventListener(type, handler) {
          this.listeners[type].push(handler);
        }

        removeEventListener(type, handler) {
          this.listeners[type] = this.listeners[type].filter((fn) => fn !== handler);
        }

        send(payload) {
          this.lastSent = payload;
        }

        close(code = 1000, reason = "") {
          this.readyState = PlaywrightMockWebSocket.CLOSED;
          this._dispatch("close", { code, reason });
        }

        _dispatch(type, payload) {
          const handlers = [...(this.listeners[type] || [])];
          handlers.forEach((handler) => handler(payload));
        }
      }

      PlaywrightMockWebSocket.CONNECTING = 0;
      PlaywrightMockWebSocket.OPEN = 1;
      PlaywrightMockWebSocket.CLOSED = 3;

      window.PlaywrightMockWebSocket = PlaywrightMockWebSocket;
      window.WebSocket = PlaywrightMockWebSocket;
    });

    await page.goto("/workspace/demo");
    const promptInput = page.locator("textarea#primary-prompt-input");
    await promptInput.fill("Hello agent");
    await page.getByLabel("Send").click();

    await page.waitForFunction(() => window.__mockSockets?.length === 1);

    await page.evaluate(() => {
      const socket = window.__mockSockets[0];
      socket._dispatch("open");
      socket._dispatch("message", {
        data: JSON.stringify({
          type: "statusResponse",
          content: "Agent booting",
          uuid: "status-1",
        }),
      });
    });

    await page.evaluate(() => {
      window.__mockSockets[0]._dispatch("close", {
        code: 1011,
        reason: "connection lost",
      });
    });

    await page.waitForFunction(() => window.__mockSockets?.length === 2);

    await page.evaluate(() => {
      const socket = window.__mockSockets[1];
      socket._dispatch("open");
      socket._dispatch("message", {
        data: JSON.stringify({
          type: "statusResponse",
          content: "Agent recovered",
          uuid: "status-2",
        }),
      });
    });

    await page.evaluate(() => {
      window.__mockSockets[1]._dispatch("close", {
        code: 1000,
        reason: "complete",
      });
    });

    await expect(page.getByText("Agent recovered", { exact: false })).toBeVisible();
    await expect(
      page.getByText("Agent session complete.", { exact: false })
    ).toBeVisible();
  });
});

test.describe("Multi-user workspace permissions", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\.(png|jpg|webp|svg|gif)$/i, (route) =>
      route.fulfill({ status: 200, body: "" })
    );
  });

  test("viewer role cannot embed parsed files", async ({ page }) => {
    await setLocalUser(page, { id: 42, username: "viewer", role: "default" });
    let parsedRequestCount = 0;

    await stubApi(page, {
      "/api/setup-complete": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: {
              MultiUserMode: true,
              RequiresAuth: true,
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
            workspace: { id: 10, slug: "demo", name: "Demo" },
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
      "/api/workspace/demo/parsed-files": (route) => {
        parsedRequestCount += 1;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            files: [
              { id: "file-1", name: "report.pdf" },
              { id: "file-2", name: "notes.md" },
            ],
            contextWindow: 1000,
            currentContextTokenCount: parsedRequestCount === 1 ? 900 : 0,
          }),
        });
      },
    });

    await page.goto("/workspace/demo");
    const attachButton = page.locator("#attach-item-btn");
    await attachButton.hover();
    await page.waitForTimeout(400);

    await expect(
      page.locator("text=You have exceeded the context window limit")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Embed Files into Workspace/i })
    ).toHaveCount(0);
  });

  test("manager role can embed parsed files", async ({ page }) => {
    await setLocalUser(page, { id: 7, username: "manager", role: "manager" });
    let parsedRequestCount = 0;
    let embedCalls = 0;

    await stubApi(page, {
      "/api/setup-complete": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: {
              MultiUserMode: true,
              RequiresAuth: true,
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
            workspace: { id: 11, slug: "demo", name: "Demo" },
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
      "/api/workspace/demo/parsed-files": (route) => {
        parsedRequestCount += 1;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            files:
              parsedRequestCount === 1
                ? [
                    { id: "file-1", name: "report.pdf" },
                    { id: "file-2", name: "notes.md" },
                  ]
                : [],
            contextWindow: 1000,
            currentContextTokenCount: parsedRequestCount === 1 ? 900 : 0,
          }),
        });
      },
      "/api/workspace/demo/embed-parsed-file/file-1": (route) => {
        embedCalls += 1;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      },
      "/api/workspace/demo/embed-parsed-file/file-2": (route) => {
        embedCalls += 1;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      },
    });

    await page.goto("/workspace/demo");
    const attachButton = page.locator("#attach-item-btn");
    await attachButton.hover();
    await page.waitForTimeout(400);

    const embedButton = page.getByRole("button", {
      name: /Embed Files into Workspace/i,
    });
    await expect(embedButton).toBeVisible();
    await embedButton.click();

    await expect(
      page.getByText("files embedded successfully", { exact: false })
    ).toBeVisible();
    expect(embedCalls).toBe(2);
  });
});

test.describe("Theme customization", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\.(png|jpg|webp|svg|gif)$/i, (route) =>
      route.fulfill({ status: 200, body: "" })
    );
  });

  test("adjusts presets and typography", async ({ page }) => {
    await setLocalUser(page, { id: 84, username: "admin", role: "admin" });
    await stubApi(page, {
      "/api/setup-complete": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: {
              MultiUserMode: true,
              RequiresAuth: true,
              LLMProvider: "openai",
              VectorDB: "lancedb",
            },
          }),
        }),
    });

    await page.goto("/settings/theme-studio");
    await page.selectOption('select[aria-label="Select theme preset"]', "light");
    await expect(page.getByText("Mode: Light")).toBeVisible();

    await page.selectOption("#font-family-select", "'DM Sans', 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif");
    await page.getByRole("button", { name: "Compact" }).click();

    const storedTheme = await page.evaluate(() =>
      window.localStorage.getItem("anythingllm_theme_84")
    );
    expect(storedTheme).toContain("\"activePreset\":\"light\"");
    expect(storedTheme).toContain("\"density\":\"compact\"");

    const fontVariable = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--theme-font-family"
      )
    );
    expect(fontVariable).toContain("DM Sans");
  });
});

test.describe("Global keyboard shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\.(png|jpg|webp|svg|gif)$/i, (route) =>
      route.fulfill({ status: 200, body: "" })
    );
  });

  test("opens help overlay and navigates to settings", async ({ page }) => {
    await setLocalUser(page, { id: 99, username: "admin", role: "admin" });
    await stubApi(page, {
      "/api/setup-complete": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: {
              MultiUserMode: true,
              RequiresAuth: true,
              LLMProvider: "openai",
              VectorDB: "lancedb",
            },
          }),
        }),
    });

    await page.goto("/");
    await page.keyboard.press("Control+Shift+/");
    await expect(page.getByText("Keyboard Shortcuts")).toBeVisible();

    await page.keyboard.press("Control+,");
    await page.waitForFunction(
      () => window.location.pathname === "/settings/interface"
    );
  });
});
