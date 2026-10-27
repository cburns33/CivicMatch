import { expect, test } from "@playwright/test";

test("governor guide includes every certified name and saves a private questionnaire", async ({ page, context }) => {
  const answerRequests: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET" && request.method() !== "HEAD") answerRequests.push(request.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your priorities. A clearer comparison." })).toBeVisible();
  for (const name of ["Greg Abbott", "Gina Hinojosa", "Pat Dixon", "Edward Earl Giles", "Jenn Mack", "Jinghpaw Majoishingra", "Mike Miller"]) await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Answer seven questions" }).click();
  const groups = page.getByRole("group");
  await expect(groups).toHaveCount(7);
  await groups.nth(0).getByRole("radio", { name: "Neither agree nor disagree", exact: true }).check();
  await groups.nth(1).getByRole("radio", { name: "Agree", exact: true }).check();
  await page.getByRole("combobox").nth(0).selectOption("5");
  await page.getByRole("combobox").nth(1).selectOption("5");
  await page.getByRole("button", { name: "Skip this question", exact: true }).nth(2).click();
  await page.getByRole("button", { name: "Review answers", exact: true }).click();
  await expect(page.getByText("2 answered, including 1 neutral · 1 skipped · 4 unanswered.", { exact: true })).toBeVisible();
  await expect(page.getByText("Most important", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "See comparison", exact: true }).click();
  await expect(page.getByText("Insufficient information", { exact: true })).toHaveCount(7);
  await expect(page.getByText("Position review is pending.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Continue your questions", exact: true }).click();
  await expect(groups.nth(0).getByRole("radio", { name: "Neither agree nor disagree", exact: true })).toBeChecked();
  await expect(page.getByRole("combobox").nth(0)).toHaveValue("5");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await context.cookies()).toEqual([]);
  // Next's development indicator can send framework requests; political answers must never leave the browser.
  expect(answerRequests.filter((url) => !url.includes("__nextjs"))).toEqual([]);
  await page.getByRole("button", { name: "Clear my saved answers", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Answer seven questions", exact: true }).click();
  await expect(page.getByText("0 of 7 answered · 0 skipped", { exact: true })).toBeVisible();
});

test("public research access is denied and corrupt device data is recoverable", async ({ page, request }) => {
  const response = await request.get("/api/research-preview"); expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.text()).not.toContain("positions");
  await page.addInitScript(() => localStorage.setItem("civicmatch:governor-questions-v1", "corrupt"));
  await page.goto("/"); await page.getByRole("button", { name: "Answer seven questions" }).click();
  await expect(page.getByText("0 of 7 answered · 0 skipped", { exact: true })).toBeVisible();
});
