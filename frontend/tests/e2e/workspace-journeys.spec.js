const { test, expect } = require("@playwright/test");
const {
  fetchAuthToken,
  setSessionStorage,
  assertAccessibility,
  assertNavigationPerformance,
  ensureWorkspaceAbsent,
  resetWorkspaceChats,
} = require("./helpers/backend");

const WORKSPACE_SLUG = "regression";

test.describe("Core workspace journeys", () => {
  let session;

  test.beforeEach(async ({ page, request }) => {
    session = await fetchAuthToken(request);
    await setSessionStorage(page, session);
    await resetWorkspaceChats(request, session.token, WORKSPACE_SLUG);
    await page.route(/\.(png|jpg|jpeg|gif|webp|svg)$/i, (route) =>
      route.fulfill({ status: 200, body: "" })
    );
  });

  test("allows workspace creation during onboarding", async ({
    page,
    request,
  }) => {
    await ensureWorkspaceAbsent(request, session.token, "playwright-space");

    await page.goto("/onboarding/create-workspace");
    await assertAccessibility(page);
    await assertNavigationPerformance(page);

    await page.fill('input[name="name"]', "Playwright Space");
    await page.keyboard.press("Enter");

    await expect(
      page.getByText("Workspace created successfully", { exact: false })
    ).toBeVisible();
    await page.waitForURL("**/");
    await assertAccessibility(page);
    await assertNavigationPerformance(page);
    await expect(
      page.getByText("Playwright Space", { exact: false })
    ).toBeVisible();

    await ensureWorkspaceAbsent(request, session.token, "playwright-space");
  });

  test("agent selection seeds prompt and streams status", async ({ page }) => {
    await page.goto(`/workspace/${WORKSPACE_SLUG}?action=set-agent-chat`);
    await assertAccessibility(page);
    await assertNavigationPerformance(page);

    await page.getByLabel(/agents/i).click();
    const promptInput = page.locator("textarea#primary-prompt-input");
    await expect(promptInput).toHaveValue("@agent ");

    await promptInput.type("Status green across the board");
    await page.getByLabel("Send").click();

    await expect(
      page.getByText(
        "Integration response for: @agent Status green across the board",
        { exact: false }
      )
    ).toBeVisible();
  });
});
