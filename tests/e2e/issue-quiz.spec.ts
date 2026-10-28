import { expect, test, type Page } from "@playwright/test";

async function completeQuiz(page: Page) {
  await page.getByRole("button", { name: "Start the quiz", exact: true }).click();
  for (let index = 0; index < 5; index++) {
    await expect(page.getByText(`Issue ${index + 1} of 5`, { exact: false })).toBeVisible();
    for (const group of await page.getByRole("group").all()) await group.getByRole("radio", { name: "Agree", exact: true }).check();
    await page.getByRole("button", { name: index === 4 ? "Review all answers" : "Next issue", exact: true }).click();
  }
}

test("one issue quiz ends in comparisons to all governor and Senate candidates", async ({ page, context }) => {
  const writes: string[] = [];
  page.on("request", (request) => { if (!["GET", "HEAD"].includes(request.method()) && !request.url().includes("__nextjs")) writes.push(request.url()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your views. Issue by issue." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ken Paxton", exact: true })).toHaveCount(0);
  await completeQuiz(page);
  await expect(page.getByText("14 answered, including 0 neutral · 0 skipped · 0 unanswered.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Compare all candidates", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your candidate comparisons.", exact: true })).toBeVisible();
  await expect(page.locator(".race-candidate-grid > article")).toHaveCount(14);
  const governor = page.locator("#candidate-guide-governor"), senate = page.locator("#candidate-guide-senate");
  await expect(governor.getByText("70% policy agreement (provisional)", { exact: true })).toHaveCount(1);
  await expect(senate.getByText("70% policy agreement (provisional)", { exact: true })).toHaveCount(1);
  await expect(senate.getByText("92% policy agreement (provisional)", { exact: true })).toHaveCount(1);
  await expect(senate.getByText("60% policy agreement (provisional)", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Insufficient information", { exact: true })).toHaveCount(8);
  for (const name of ["Greg Abbott", "Gina Hinojosa", "Pat Dixon", "Edward Earl Giles", "Jenn Mack", "Jinghpaw Majoishingra", "Mike Miller", "Ken Paxton", "James Talarico", "Ted Brown", "Avery Ayers", 'Bradford "Brad" Hall', "Zul Mohamed", "Jade Simmons"]) await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const paxton = senate.locator("article").nth(0);
  await paxton.getByText("Federal gun checks: Disagree", { exact: true }).click();
  await expect(paxton.getByText("The lawsuit also challenged agency authority", { exact: false })).toBeVisible();
  await expect(paxton.getByRole("link", { name: "Paxton private-firearm-sales challenge", exact: false })).toHaveAttribute("href", /texasattorneygeneral\.gov/);
  await expect(senate.locator("article").nth(4).getByText("2/7 questions", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await context.cookies()).toEqual([]); expect(writes).toEqual([]);
});

test("neutral, skip, navigation, importance, reload and editing retain one set of answers", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Start the quiz", exact: true }).click();
  const groups = page.getByRole("group");
  await groups.nth(0).getByRole("radio", { name: "Neither agree nor disagree", exact: true }).check();
  await groups.nth(1).getByRole("radio", { name: "Agree", exact: true }).check();
  await page.getByRole("combobox").nth(0).selectOption("5"); await page.getByRole("combobox").nth(1).selectOption("5");
  await page.getByRole("button", { name: "Skip this question", exact: true }).nth(2).click();
  await page.getByRole("button", { name: "Next issue", exact: true }).click();
  await page.getByRole("button", { name: "Previous issue", exact: true }).click();
  await expect(groups.nth(0).getByRole("radio", { name: "Neither agree nor disagree", exact: true })).toBeChecked();
  await page.reload(); await page.getByRole("button", { name: "Continue the quiz", exact: true }).click();
  await page.getByRole("button", { name: "1. Economy and housing", exact: true }).click();
  await expect(page.getByRole("combobox").nth(0)).toHaveValue("5");
  await page.getByRole("button", { name: "5. Safety and immigration", exact: true }).click();
  await page.getByRole("button", { name: "Review all answers", exact: true }).click();
  await expect(page.getByText("2 answered, including 1 neutral · 1 skipped · 11 unanswered.", { exact: true })).toBeVisible();
  await expect(page.getByText("Most important", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Compare all candidates", exact: true }).click();
  await expect(page.getByText("Insufficient information", { exact: true })).toHaveCount(14);
  await page.getByRole("button", { name: "Edit answers and importance", exact: true }).click();
  await expect(groups.nth(0).getByRole("radio", { name: "Neither agree nor disagree", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Clear my saved answers", exact: true }).click();
  await page.reload(); await page.getByRole("button", { name: "Start the quiz", exact: true }).click();
  await expect(page.getByText("0 of 14 answered · 0 skipped", { exact: true })).toBeVisible();
});

test("earlier governor answers migrate without answering federal questions", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("migration-seeded")) {
      localStorage.setItem("civicmatch:governor-questions-v1", JSON.stringify({ version: 1, answers: { "tax-v1": { state: "answered", value: 5, importance: 4 } } }));
      localStorage.setItem("migration-seeded", "yes");
    }
  });
  await page.goto("/"); await page.getByRole("button", { name: "Continue the quiz", exact: true }).click();
  await expect(page.getByText("1 of 14 answered · 0 skipped", { exact: true })).toBeVisible();
  await expect(page.getByRole("group").nth(0).getByRole("radio", { name: "Strongly agree", exact: true })).toBeChecked();
  await expect(page.getByRole("group").nth(2).getByRole("radio", { name: "Strongly agree", exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Clear my saved answers", exact: true }).click(); await page.reload();
  await expect(page.getByRole("button", { name: "Start the quiz", exact: true })).toBeVisible();
});

test("corrupt saved answers recover and anonymous private research access remains denied", async ({ page, request }) => {
  const response = await request.get("/api/research-preview"); expect(response.status()).toBe(401);
  await page.addInitScript(() => localStorage.setItem("civicmatch:issue-quiz-v1", "corrupt"));
  await page.goto("/"); await page.getByRole("button", { name: "Start the quiz", exact: true }).click();
  await expect(page.getByText("0 of 14 answered · 0 skipped", { exact: true })).toBeVisible();
});
