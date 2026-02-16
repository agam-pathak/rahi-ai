import { expect, test } from "@playwright/test";

type Scenario = {
  name: string;
  mode: "ai" | "budget" | "chat";
  viewport: { width: number; height: number };
  heading: RegExp;
};

const scenarios: Scenario[] = [
  {
    name: "planner-ai-desktop",
    mode: "ai",
    viewport: { width: 1440, height: 980 },
    heading: /AI Trip Planner/i,
  },
  {
    name: "planner-ai-mobile",
    mode: "ai",
    viewport: { width: 390, height: 844 },
    heading: /AI Trip Planner/i,
  },
  {
    name: "planner-budget-desktop",
    mode: "budget",
    viewport: { width: 1440, height: 980 },
    heading: /Budget Guardian/i,
  },
  {
    name: "planner-chat-desktop",
    mode: "chat",
    viewport: { width: 1440, height: 980 },
    heading: /AI Travel Buddy/i,
  },
  {
    name: "planner-chat-mobile",
    mode: "chat",
    viewport: { width: 390, height: 844 },
    heading: /AI Travel Buddy/i,
  },
];

for (const scenario of scenarios) {
  test(scenario.name, async ({ page }) => {
    await page.setViewportSize(scenario.viewport);
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    await page.goto(`/planner?mode=${scenario.mode}&type=adventure&premium=1`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("main.rahi-planner-page")).toBeVisible();
    await expect(page.getByRole("heading", { name: scenario.heading })).toBeVisible();

    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
        }
      `,
    });

    await expect(page.locator("main.rahi-planner-page")).toHaveScreenshot(
      `${scenario.name}.png`,
      {
        animations: "disabled",
      }
    );
  });
}
