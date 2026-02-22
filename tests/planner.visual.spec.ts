import { expect, test } from "@playwright/test";

type Scenario = {
  name: string;
  mode: "ai" | "budget" | "chat";
  viewport: { width: number; height: number };
  headingText: string;
};

const scenarios: Scenario[] = [
  {
    name: "planner-ai-desktop",
    mode: "ai",
    viewport: { width: 1440, height: 980 },
    headingText: "AI Trip Planner",
  },
  {
    name: "planner-ai-mobile",
    mode: "ai",
    viewport: { width: 390, height: 844 },
    headingText: "AI Trip Planner",
  },
  {
    name: "planner-budget-desktop",
    mode: "budget",
    viewport: { width: 1440, height: 980 },
    headingText: "Budget Guardian",
  },
  {
    name: "planner-chat-desktop",
    mode: "chat",
    viewport: { width: 1440, height: 980 },
    headingText: "AI Travel Buddy",
  },
  {
    name: "planner-chat-mobile",
    mode: "chat",
    viewport: { width: 390, height: 844 },
    headingText: "AI Travel Buddy",
  },
];

const modeButtonLabel: Record<Scenario["mode"], string> = {
  ai: "Planner",
  budget: "Budget",
  chat: "Chat",
};

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

    await page
      .getByRole("button", {
        name: new RegExp(`Switch planner mode to ${modeButtonLabel[scenario.mode]}`, "i"),
      })
      .click();

    await expect(
      page.locator("main.rahi-planner-page .rahi-hero-title").first()
    ).toContainText(scenario.headingText);

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
