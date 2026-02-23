import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const openChatBuddy = async (page: import("@playwright/test").Page) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto("/planner?mode=chat&type=adventure&premium=1", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("main.rahi-planner-page")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByPlaceholder(/Ask Rahi/i)).toBeVisible({ timeout: 60_000 });
};

test("chat buddy sends a message and renders reply", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/api/ai/chat", async (route) => {
    requestCount += 1;
    const payload = route.request().postDataJSON() as { message?: string };
    expect(payload.message).toContain("Goa");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: "Rahi.AI: Goa trip draft ready.",
      }),
    });
  });

  await openChatBuddy(page);

  const input = page.getByPlaceholder(/Ask Rahi/i);
  await input.fill("Plan a Goa itinerary");
  await page.getByRole("button", { name: "Send chat message" }).click();

  await expect(page.getByText("Goa trip draft ready.")).toBeVisible();
  expect(requestCount).toBe(1);
});

test("chat buddy blocks duplicate sends while waiting", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/api/ai/chat", async (route) => {
    requestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: "Response after delay.",
      }),
    });
  });

  await openChatBuddy(page);

  const input = page.getByPlaceholder(/Ask Rahi/i);
  const sendButton = page.getByRole("button", { name: "Send chat message" });

  await input.fill("First question");
  await sendButton.click();
  await expect(sendButton).toBeDisabled();
  await page.keyboard.press("Enter");

  await expect(page.getByText("Response after delay.")).toBeVisible();
  expect(requestCount).toBe(1);
});

test("chat itinerary can be converted back to planner mode", async ({ page }) => {
  await page.route("**/api/ai/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply:
          "Goa Itinerary\nDay 1: Beach + sunset.\nDay 2: Old Goa + cafes.\nBudget: ₹12,000",
      }),
    });
  });

  await openChatBuddy(page);

  await page.getByPlaceholder(/Ask Rahi/i).fill("Build a Goa itinerary");
  await page.getByRole("button", { name: "Send chat message" }).click();

  const convertButton = page.getByRole("button", { name: /Convert to Planner/i });
  await expect(convertButton).toBeVisible();
  await convertButton.click();

  const daysMetric = page.locator(".rahi-hero-metric").filter({ hasText: "Days" }).first();
  const budgetMetric = page.locator(".rahi-hero-metric").filter({ hasText: "Budget" }).first();
  await expect(daysMetric).toContainText("2");
  await expect(budgetMetric).toContainText("₹12,000");
});

test("chat shows sign-in guidance on unauthorized API response", async ({ page }) => {
  await page.route("**/api/ai/chat", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unauthorized" }),
    });
  });

  await openChatBuddy(page);

  await page.getByPlaceholder(/Ask Rahi/i).fill("hello");
  await page.getByRole("button", { name: "Send chat message" }).click();
  await expect(page.getByText("Please sign in again to use Chat Buddy.")).toBeVisible();
});
