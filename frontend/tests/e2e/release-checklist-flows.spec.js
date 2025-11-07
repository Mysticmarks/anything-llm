const { test, expect } = require("@playwright/test");
const {
  fetchAuthToken,
  setSessionStorage,
  assertAccessibility,
  assertNavigationPerformance,
  ensureWorkspaceAbsent,
} = require("./helpers/backend");

const WORKSPACE_SLUG = "regression";

test.describe("Release checklist critical flows", () => {
  let session;

  test.beforeEach(async ({ page, request }) => {
    session = await fetchAuthToken(request);
    await setSessionStorage(page, session);
    await page.route(/\.(png|jpg|jpeg|gif|webp|svg)$/i, (route) =>
      route.fulfill({ status: 200, body: "" })
    );
  });

  test("walks onboarding path and provisions a workspace", async ({
    page,
    request,
  }) => {
    await ensureWorkspaceAbsent(request, session.token, "release-checklist-workspace");

    await page.goto("/onboarding");
    await assertAccessibility(page);
    await assertNavigationPerformance(page);

    await page.getByRole("button", { name: /get started/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /just me/i }).click();
    await page.getByRole("button", { name: /^no$/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /skip/i }).click();

    await page.fill('input[name="name"]', "Release Checklist Workspace");
    await page.keyboard.press("Enter");

    await expect(
      page.getByText("Workspace created successfully", { exact: false })
    ).toBeVisible();
    await page.waitForURL("**/");
    await assertAccessibility(page);
    await assertNavigationPerformance(page);

    await ensureWorkspaceAbsent(request, session.token, "release-checklist-workspace");
  });

  test("renders seeded chat history for regression workspace", async ({ page }) => {
    await page.goto(`/workspace/${WORKSPACE_SLUG}`);
    await assertAccessibility(page);
    await assertNavigationPerformance(page);

    await expect(
      page.getByText("What documents are available?", { exact: false })
    ).toBeVisible();
    await expect(
      page.getByText("Integration response for: What documents are available", {
        exact: false,
      })
    ).toBeVisible();
  });
});
