const { test, expect } = require("@playwright/test");
const {
  fetchAuthToken,
  setSessionStorage,
  assertAccessibility,
} = require("./helpers/backend");
const { assertKeyboardTraversal } = require("./helpers/accessibility");

let session;

test.describe("Accessibility audits", () => {
  test.beforeEach(async ({ page, request }) => {
    session = await fetchAuthToken(request);
    await setSessionStorage(page, session);
    await page.route(/\.(png|jpg|jpeg|gif|webp|svg)$/i, (route) =>
      route.fulfill({ status: 200, body: "" })
    );
  });

  test("Theme Studio honors keyboard navigation and ARIA labels", async ({ page }) => {
    await page.goto("/settings/theme-studio");
    await assertAccessibility(page);

    await assertKeyboardTraversal(page, [
      page.getByLabel("Select theme preset"),
      page.getByRole("button", { name: /Reset to Preset Defaults/i }),
      page.getByLabel("Background Hue"),
      page.getByLabel("Font family"),
      page.getByLabel("Accent saturation boost"),
      page.getByLabel("Procedural overlay strength"),
    ]);

    await page.getByLabel("Accent saturation boost").press("ArrowRight");
    await expect(page.getByLabel("Accent saturation boost")).toBeFocused();
    await expect(
      page.getByLabel("Procedural overlay strength")
    ).toHaveAttribute("type", "range");
  });
});
