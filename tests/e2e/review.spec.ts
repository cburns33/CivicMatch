import { expect, test, type Page } from "@playwright/test";

async function mockReviewService(page: Page, reviewer = true) {
  let accepted = false;
  const calls: string[] = [];
  const actor = "00000000-0000-4000-8000-000000000001";
  const source = { sha256: "a".repeat(64), title: "SYNTHETIC review source", url: "https://votetravis.gov/synthetic-test-only.pdf" };
  await page.route("https://review-test.example/**", async (route) => {
    const url = new URL(route.request().url()); calls.push(url.pathname);
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
    let body: unknown;
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname === "/auth/v1/token") {
      const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: actor, exp: Math.floor(Date.now()/1000)+3600, aud: "authenticated" })).toString("base64url"), "synthetic"];
      body = { access_token: token.join("."), token_type: "bearer", expires_in: 3600, refresh_token: "synthetic", user: { id: actor, aud: "authenticated", email: "reviewer@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
    } else if (url.pathname.endsWith("/is_composition_reviewer")) body = reviewer;
    else if (url.pathname.endsWith("/composition_review_progress")) body = [{ run_sha256: "b".repeat(64), county: "travis", total: 2, accepted: accepted ? 1 : 0, open: accepted ? 1 : 2, requires_new_import: 1 }];
    else if (url.pathname.endsWith("/composition_review_page")) body = [
      { id: actor, task_key: "record:example", kind: "record", payload: { printedTitle: "SYNTHETIC private race", sourceSha256: source.sha256, sourcePage: 2, candidates: [{ printedName: "SYNTHETIC private candidate" }] }, requires_new_import: false,
        last_decision: accepted ? { decision: "accepted", note: "Compared this synthetic record with its source page.", reviewerId: actor, decidedAt: new Date().toISOString() } : null },
      { id: "00000000-0000-4000-8000-000000000002", task_key: "issue:style", kind: "issue", payload: { message: "Official ballot style remains unverified", sourceSha256: source.sha256 }, requires_new_import: true, last_decision: null },
    ];
    else if (url.pathname.endsWith("/decide_composition_task")) {
      const input = route.request().postDataJSON();
      expect(input.p_source_hashes).toEqual([source.sha256]);
      accepted = input.p_decision === "accepted"; body = 1;
    } else if (url.pathname === "/rest/v1/composition_review_tasks") body = [{ payload: source }];
    else if (url.pathname === "/auth/v1/logout") return route.fulfill({status: 204, headers});
    else throw new Error(`Unexpected mock service route: ${url.pathname}`);
    await route.fulfill({status: 200, contentType: "application/json", headers, body: JSON.stringify(body)});
  });
  return calls;
}

test("review sign-in, source-linked decision, hard blocker, and sign-out", async ({page}) => {
  await mockReviewService(page);
  await page.goto("/admin");
  await expect(page.getByText("SYNTHETIC private candidate")).toHaveCount(0);
  await page.getByLabel("Email", {exact: true}).fill("reviewer@example.test");
  await page.getByLabel("Password", {exact: true}).fill("synthetic-only-password");
  await page.getByRole("button", {name: "Sign in to review", exact: true}).click();
  await expect(page.getByText("SYNTHETIC private candidate")).toBeVisible();
  const task = page.locator("section.official-document").first();
  await task.getByLabel("Decision", {exact: true}).selectOption("accepted");
  await task.getByLabel("Evidence and reason", {exact: true}).fill("Compared this synthetic record with its source page.");
  await task.getByRole("button", {name: "Save decision"}).click();
  await expect(page.getByText("Latest decision: accepted", {exact: true})).toBeVisible();
  await expect(page.getByText("Accepted tasks: 1.", {exact: false})).toBeVisible();
  const blocked = page.locator("section.official-document").nth(1);
  await expect(blocked.locator('option[value="accepted"]')).toHaveAttribute("disabled", "");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", {name: "Sign out", exact: true}).click();
  await expect(page.getByText("SYNTHETIC private candidate")).toHaveCount(0);
});

test("a signed-in account without reviewer access never loads draft records", async ({page}) => {
  const calls = await mockReviewService(page, false);
  await page.goto("/admin");
  await page.getByLabel("Email", {exact: true}).fill("ordinary@example.test");
  await page.getByLabel("Password", {exact: true}).fill("synthetic-only-password");
  await page.getByRole("button", {name: "Sign in to review", exact: true}).click();
  await expect(page.getByText("This account does not have reviewer access.", {exact: true})).toBeVisible();
  expect(calls.some((url) => url.endsWith("composition_review_page"))).toBe(false);
});
