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
    window.localStorage.setItem(
      "anythingllm_user",
      JSON.stringify(data.user)
    );
    window.localStorage.setItem("anythingllm_authToken", data.token);
  }, { user, token });
}

test.describe("Release checklist critical flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\.(png|jpg|webp|svg|gif)$/i, (route) =>
      route.fulfill({ status: 200, body: "" })
    );
  });

  test("completes onboarding path and provisions workspace", async ({ page }) => {
    let capturedEnvPayload = null;
    let createdWorkspaceSlug = null;

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
              EmbeddingEngine: "native",
            },
          }),
        }),
      "/api/system/update-env": async (route) => {
        capturedEnvPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ newValues: { LLMProvider: "openai" } }),
        });
      },
      "/api/workspace/new": async (route) => {
        const payload = route.request().postDataJSON();
        expect(payload).toMatchObject({
          name: "Release Checklist Workspace",
          onboardingComplete: true,
        });
        createdWorkspaceSlug = "release-checklist-workspace";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            workspace: {
              id: 44,
              slug: createdWorkspaceSlug,
              name: "Release Checklist Workspace",
            },
            message: "created",
          }),
        });
      },
    });

    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Get Started" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Just Me" }).click();
    await page.getByRole("button", { name: "No" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Skip" }).click();

    await page.fill('input[name="name"]', "Release Checklist Workspace");
    await page.keyboard.press("Enter");

    await expect(
      page.getByText("Workspace created successfully!", { exact: false })
    ).toBeVisible();
    expect(capturedEnvPayload).toMatchObject({
      LLMProvider: "openai",
      EmbeddingEngine: "native",
      VectorDB: "lancedb",
    });
    await page.waitForURL(`**/workspace/${createdWorkspaceSlug ?? ""}`);
  });

  test("streams assistant reply with documented sources", async ({ page }) => {
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
      "/api/workspace/release": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            workspace: {
              id: 55,
              slug: "release",
              name: "Release QA",
            },
          }),
        }),
      "/api/workspace/release/suggested-messages": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ suggestedMessages: [] }),
        }),
      "/api/workspace/release/pfp": (route) =>
        route.fulfill({ status: 204, body: "" }),
      "/api/workspace/release/chats": (route) =>
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
              uuid: "release-stream",
              type: "textResponseChunk",
              textResponse: "Testable insight",
              close: false,
              sources: [],
            })}\n\n` +
            `data: ${JSON.stringify({
              uuid: "release-stream",
              type: "textResponseChunk",
              textResponse: " with citations.",
              close: false,
              sources: [
                {
                  id: "doc-1",
                  title: "Runbook",
                  url: "https://example.com/runbook",
                },
              ],
            })}\n\n` +
            `data: ${JSON.stringify({
              uuid: "release-stream",
              type: "textResponseChunk",
              textResponse: "",
              close: true,
              sources: [
                {
                  id: "doc-1",
                  title: "Runbook",
                  url: "https://example.com/runbook",
                },
              ],
            })}\n\n`,
        }),
    });

    await page.goto("/workspace/release");
    const promptInput = page.locator("textarea#primary-prompt-input");
    await promptInput.fill("Summarize readiness checks");
    await page.getByLabel("Send").click();

    await expect(page.getByText("Testable insight with citations.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Runbook" })).toBeVisible();
  });

  test("exports and clears recorded chats from settings", async ({ page }) => {
    await setLocalUser(page, { id: 777, username: "release-admin", role: "admin" });

    let exportRequests = 0;
    let deleteAllRequests = 0;

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
      "/api/system/check-token": (route) => route.fulfill({ status: 200, body: "" }),
      "/api/system/workspace-chats": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            chats: [
              {
                id: 101,
                prompt: "How many docs are indexed?",
                response: JSON.stringify({ text: "There are 12 documents." }),
                createdAt: "2024-06-01",
                workspace: { name: "Release Lab" },
                user: { username: "release-admin" },
              },
            ],
            hasPages: false,
          }),
        }),
      "/api/system/export-chats": async (route) => {
        exportRequests += 1;
        await route.fulfill({
          status: 200,
          contentType: "text/plain",
          body: "mock,export",
        });
      },
      "/api/system/workspace-chats/-1": async (route) => {
        deleteAllRequests += 1;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      },
      "/api/system/workspace-chats/101": (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        }),
    });

    await page.goto("/settings/workspace-chats");
    await expect(page.getByText("Release Lab")).toBeVisible();

    await page.getByRole("button", { name: /Export/i }).click();
    await page.getByRole("button", { name: "JSON" }).click();
    await expect(
      page.getByText("Chats exported successfully as JSON.")
    ).toBeVisible();
    expect(exportRequests).toBeGreaterThan(0);

    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await page.getByRole("button", { name: "Clear Chats" }).click();
    await expect(page.getByText("Cleared all chats.")).toBeVisible();
    expect(deleteAllRequests).toBe(1);
  });
});
