const { expect } = require("@playwright/test");

async function assertKeyboardTraversal(page, orderedLocators, maxTabsPerTarget = 12) {
  await page.focus("body");
  for (const locator of orderedLocators) {
    let found = false;
    for (let i = 0; i < maxTabsPerTarget; i++) {
      await page.keyboard.press("Tab");
      if (await locator.isFocused()) {
        found = true;
        break;
      }
    }
    expect(found).toBeTruthy();
  }
}

module.exports = {
  assertKeyboardTraversal,
};
