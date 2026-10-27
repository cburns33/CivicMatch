import { expect, test } from "@playwright/test";

test("official intake shows sources and pending scope without unreviewed candidates", async ({
  page,
}) => {
  await page.goto("/sources");
  await page
    .getByRole("link", {
      name: "View Travis and Harris official source intake",
      exact: false,
    })
    .click();
  await page.waitForURL("**/official-data");
  await expect(
    page.getByRole("heading", { name: "Building from the official record." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Travis County", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Harris County", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "121 candidate contests and 261 printed candidate entries staged.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "193 candidate contests and 394 printed candidate entries staged.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open official document", exact: false }),
  ).toHaveCount(7);
  await page.getByText("51 cancellation documents and archive details", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "City of Mustang Ridge", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open official document", exact: false })).toHaveCount(58);
  await page.getByText("51 cancellation documents and archive details", { exact: true }).click();
  await page
    .getByText("Source checksum and retrieval details", { exact: true })
    .first()
    .click();
  await expect(
    page.getByText(
      "fad1c5a7d794e59d23cb12f616c29c4ab3ff94571c04f61cb6aa89231babb3ea",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText("Ken Paxton", { exact: false })).toHaveCount(0);
  await expect(page.getByText("LASHAWN NASH", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Ballot style validation", exact: true })).toBeVisible();
  await expect(page.getByText("0 individual style references checked, 0 verified styles", { exact: false })).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("browse labeled fixtures, switch city, and inspect ballot edge cases", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Every contest. A clearer picture." }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Every name, contest assignment, and measure below is synthetic.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(page.locator(".contest-card")).toHaveCount(10);
  await page.getByLabel("Explore a city").selectOption("houston");
  await expect(page.getByText("HOUSTON-DEMO-01")).toBeVisible();
  await page
    .getByRole("heading", { name: "U.S. Representative", exact: true })
    .click();
  await expect(
    page.getByText("Qualified write-in fixture", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Filter by office group")
    .selectOption("Ballot measures");
  await expect(page.locator(".contest-card")).toHaveCount(1);
  await page.getByRole("heading", { name: "Example Proposition A" }).click();
  await expect(
    page.getByText("SYNTHETIC FIXTURE:", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Official ballot completeness is unknown.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("search has a recoverable empty state and judicial research stays distinct", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByLabel("Search contests or example candidates")
    .fill("no such contest");
  await expect(
    page.getByRole("heading", { name: "No contests match your search." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".contest-card")).toHaveCount(10);
  await page
    .getByRole("heading", { name: "District Judge", exact: true })
    .click();
  await expect(
    page.getByText("Judicial research will focus on qualifications", {
      exact: false,
    }),
  ).toBeVisible();
});

test("methodology discloses neutral responses, defaults, gates, and scope", async ({
  page,
}) => {
  await page.goto("/methodology");
  await expect(
    page.getByRole("heading", { name: "Understand the comparison." }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Not answered", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Neutral or unsure is an answered value of 3.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Actions, interpretations, and motives stay separate.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("rowheader", {
      name: "Insider interpretation",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: "Inferred motive", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: "Limited support", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Reviewer certainty is recorded separately from evidence confidence.",
      { exact: false },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/sources");
  await expect(
    page.getByRole("link", { name: "Harris County", exact: false }),
  ).toHaveAttribute(
    "href",
    "https://www.harrisvotes.com/Voter/Whats-on-my-Ballot",
  );
});
