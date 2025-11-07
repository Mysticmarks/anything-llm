const { test, expect } = require("@playwright/test");
const {
  fetchAuthToken,
  setSessionStorage,
  assertAccessibility,
  assertNavigationPerformance,
  resetWorkspaceChats,
  getWorkspace,
} = require("./helpers/backend");

const WORKSPACE_SLUG = "regression";

test.describe("Regression coverage flows", () => {
  let session;

  test.beforeEach(async ({ page, request }) => {
    session = await fetchAuthToken(request);
    await setSessionStorage(page, session);
    await resetWorkspaceChats(request, session.token, WORKSPACE_SLUG);
    await page.route(/\.(png|jpg|jpeg|gif|webp|svg)$/i, (route) =>
      route.fulfill({ status: 200, body: "" })
    );
  });

  test("chat workspace streams assistant replies", async ({ page }) => {
    await page.goto(`/workspace/${WORKSPACE_SLUG}`);
    await assertAccessibility(page);
    await assertNavigationPerformance(page);

    const promptInput = page.locator("textarea#primary-prompt-input");
    await promptInput.fill("Summarize readiness for launch");
    await page.getByLabel("Send").click();

    await expect(
      page.getByText("Summarize readiness for launch", { exact: false })
    ).toBeVisible();
    await expect(
      page.getByText(
        "Integration response for: Summarize readiness for launch",
        { exact: false }
      )
    ).toBeVisible();
  });

  test("workspace settings update persists renamed workspace", async ({
    page,
    request,
  }) => {
    const updatedName = "Regression QA Renamed";
    const original = await getWorkspace(request, session.token, WORKSPACE_SLUG);

    await page.goto(`/workspace/${WORKSPACE_SLUG}/settings/general-appearance`);
    await assertAccessibility(page);
    await assertNavigationPerformance(page);

    const nameInput = page.locator('input[name="name"]');
    await nameInput.fill(updatedName);
    await page.getByRole("button", { name: /update workspace/i }).click();

    await expect(
      page.getByText("Workspace updated", { exact: false })
    ).toBeVisible();

    const { workspace } = await getWorkspace(
      request,
      session.token,
      WORKSPACE_SLUG
    );
    expect(workspace.name).toBe(updatedName);

    // revert to original for isolation
    if (original?.workspace?.name && original.workspace.name !== updatedName) {
      await nameInput.fill(original.workspace.name);
      await page.getByRole("button", { name: /update workspace/i }).click();
      await expect(
        page.getByText("Workspace updated", { exact: false })
      ).toBeVisible();
    }
  });
});
