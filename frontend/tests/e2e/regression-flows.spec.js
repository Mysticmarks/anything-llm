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

test.describe("Regression coverage flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\.(png|jpg|jpeg|gif|webp|svg)$/i, (route) =>
      route.fulfill({ status: 200, body: "" })
    );
  });

  test("chat workspace streams assistant replies", async ({ page }) => {
    await setLocalUser(page, { id: 88, role: "admin", username: "qa" });

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
      "/api/workspace/regression": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            workspace: {
              id: 44,
              slug: "regression",
              name: "Regression QA",
            },
          }),
        }),
      "/api/workspace/regression/suggested-messages": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ suggestedMessages: [] }),
        }),
      "/api/workspace/regression/pfp": (route) =>
        route.fulfill({ status: 204, body: "" }),
      "/api/workspace/regression/chats": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ history: [] }),
        }),
    });

    await page.route("**/api/workspace/regression/stream-chat", (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body:
          `data: ${JSON.stringify({
            uuid: "stream-qa",
            type: "textResponseChunk",
            textResponse: "Streaming reply",
            close: false,
            sources: [],
          })}\n\n` +
          `data: ${JSON.stringify({
            uuid: "stream-qa",
            type: "textResponseChunk",
            textResponse: " completed.",
            close: true,
            sources: [
              {
                id: "doc-11",
                title: "Checklist",
                url: "https://example.com/checklist",
              },
            ],
          })}\n\n`,
      })
    );

    await page.goto("/workspace/regression");

    const promptInput = page.locator("textarea#primary-prompt-input");
    await promptInput.fill("Summarize readiness");
    await page.getByLabel("Send").click();

    await expect(
      page.getByText("Streaming reply completed.", { exact: false })
    ).toBeVisible();
    await expect(
      page.getByText("Checklist", { exact: false })
    ).toBeVisible();
  });

  test("workspace settings update persists renamed workspace", async ({ page }) => {
    await setLocalUser(page, {
      id: 21,
      role: "admin",
      username: "workspace-admin",
    });

    let updatePayload = null;
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
      "/api/system/keys": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: {
              VectorDB: "lancedb",
            },
          }),
        }),
      "/api/workspace/regression": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            workspace: {
              id: 55,
              slug: "regression",
              name: "Regression QA",
            },
          }),
        }),
      "/api/workspace/regression/suggested-messages": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ suggestedMessages: [] }),
        }),
      "/api/workspace/regression/pfp": (route) =>
        route.fulfill({ status: 204, body: "" }),
      "/api/workspace/regression/update": async (route) => {
        updatePayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            workspace: { slug: "regression", name: "Renamed QA" },
            message: "updated",
          }),
        });
      },
    });

    await page.goto("/workspace/regression/settings/general-appearance");

    const nameField = page.getByLabel("Workspaces Name");
    await expect(nameField).toHaveValue("Regression QA");
    await nameField.fill("Renamed QA");
    await page.getByRole("button", { name: "Update Workspace" }).click();

    await expect.poll(() => updatePayload).toEqual({ name: "Renamed QA" });
  });

  test("agent builder saves custom flow with additional blocks", async ({ page }) => {
    await setLocalUser(page, {
      id: 1,
      role: "admin",
      username: "builder",
    });

    let savedFlowPayload = null;
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
      "/api/agent-flows/list": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            flows: [],
          }),
        }),
      "/api/agent-flows/save": async (route) => {
        savedFlowPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            flow: { uuid: "flow-qa" },
          }),
        });
      },
    });

    await page.goto("/settings/agents/builder");

    await page.fill("#agent-flow-name-input", "Smoke Test Flow");
    await page.getByLabel("Description").fill(
      "Automated QA scenario for regression coverage."
    );

    await page.getByRole("button", { name: "Add Block" }).click();
    await page.getByRole("button", { name: /API Call/ }).click();

    await page
      .getByPlaceholder("https://api.example.com/endpoint")
      .fill("https://example.com/hooks/report");

    await page.getByRole("button", { name: "Save" }).click();

    await expect.poll(() => savedFlowPayload).toMatchObject({
      name: "Smoke Test Flow",
      config: expect.objectContaining({
        steps: expect.arrayContaining([
          expect.objectContaining({
            type: "api_call",
            config: expect.objectContaining({
              url: "https://example.com/hooks/report",
            }),
          }),
        ]),
      }),
    });
  });

  test("theme studio customizes appearance controls", async ({ page }) => {
    await setLocalUser(page, {
      id: 101,
      role: "admin",
      username: "stylist",
    });

    await page.addInitScript(() => {
      window.matchMedia = window.matchMedia || ((query) => ({
        matches: query.includes("prefers-color-scheme: light"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }));
    });

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

    const presetSelect = page.getByLabel("Select theme preset");
    await presetSelect.selectOption("light");
    await expect(page.getByText("Mode: Light")).toBeVisible();

    const fontScaleSlider = page.locator("#font-scale");
    await fontScaleSlider.fill("1.12");
    await expect(page.locator('label[for="font-scale"]')).toContainText(
      "1.12x"
    );

    await page.getByRole("button", { name: "Compact" }).click();
    await expect(
      page.getByRole("button", { name: "Compact" })
    ).toHaveClass(/border-theme-button-primary/);

    await page.getByRole("button", { name: "Expressive" }).click();
    await expect(
      page.getByRole("button", { name: "Expressive" })
    ).toHaveClass(/border-theme-button-primary/);
  });
});
