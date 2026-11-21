import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("registration, partial credit, statement, mobile navigation and logout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Create one now" }).click();
  await page.getByLabel("Full Name", { exact: true }).fill("Browser Smoke");
  await page
    .getByLabel("Email Address", { exact: true })
    .fill("browser-" + Date.now() + "@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("BrowserPassword!123");
  await page.getByRole("button", { name: "Create Account & Continue" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign Out", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("viora_auth_token")),
  ).toBeNull();
  const post = async (path: string, data: unknown) => {
    const res = await page.request.post("/api" + path, {
      headers: { "X-Viora-Client": "web" },
      data,
    });
    expect(res.ok(), await res.text()).toBe(true);
    return (await res.json()).data;
  };
  const customer = await post("/customers", {
    name: "Browser Credit Customer",
    phone: "9876543210",
    billingAddress: "Browser test address",
  });
  const draft = await post("/invoices", {
    customerId: customer.id,
    invoiceDate: "2026-11-01",
    dueDate: "2026-11-30",
    items: [
      {
        descriptionSnapshot: "Browser product",
        quantity: 2,
        unitPrice: 100,
        taxRate: 18,
      },
    ],
  });
  await post("/invoices/" + draft.id + "/issue", {});
  await page.getByRole("button", { name: "Credit Notes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Credit notes", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Issue credit note", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Issue credit note" }),
  ).toBeVisible();
  await page
    .getByLabel("Original invoice", { exact: true })
    .selectOption(draft.id);
  await page.getByLabel("Credit quantity for Browser product").fill("1");
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Browser partial return");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Issue credit note", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("CN-000001", { exact: false })).toBeVisible();
  await page.screenshot({
    path: "test-results/credits-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Customer Statements", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Customer statement", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Customer", { exact: true }).selectOption(customer.id);
  await expect(page.getByText("Due ₹118.00", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Open mobile navigation" }).click();
  await expect(
    page.getByRole("dialog", { name: "Main navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/statement-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    audit.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    ),
  ).toEqual([]);
  expect(errors).toEqual([]);
});
test("unknown paths render a recovery link", async ({ page }) => {
  await page.goto("/missing-page");
  await expect(page.getByRole("heading", { name: /404/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go to dashboard" }),
  ).toHaveAttribute("href", "/");
});
