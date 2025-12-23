import { expect } from "@storybook/test-runner";

const snapshotTargets = [
  "design-theming--dark-mode-tokens",
  "chat-ui-conversations--assistant-and-user",
  "dashboards-workspace--workspace-health",
  "agent-builder-scenarios--orchestration-path",
];

export const postVisit = async (page, context) => {
  if (!snapshotTargets.some((target) => context.id.startsWith(target))) return;
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page).toHaveScreenshot(`${context.id}.png`, {
    animations: "disabled",
    fullPage: true,
  });
};
