import { expect, test } from "@playwright/test";

test("the first screen says who, what and where to go", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Stephen Sookra | Software Engineer, XR");
  await expect(page.locator("h1")).toHaveText("Stephen Sookra");
  await expect(page.getByText(/^Software engineer in Atlanta, focused on XR\./)).toBeVisible();
  await expect(
    page.getByText(
      "22 hackathon awards across 20 events. Software Engineer Intern at XR Dojo. CS at Kennesaw State.",
      { exact: true },
    ),
  ).toBeVisible();
  const quick = page.getByRole("list", { name: "Quick links" }).getByRole("link");
  await expect(quick).toHaveText(["Resume", "GitHub", "LinkedIn", "Email", "XR work", "Software work"]);
});

test("resume, GitHub and a software case study are one click from home", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("a[href='/resume']").first()).toBeVisible();
  await expect(page.locator("a[href='https://github.com/StephenSook']").first()).toBeVisible();
  await page.locator("a[href='/work/varsity']").click();
  await expect(page).toHaveURL(/\/work\/varsity$/);
  await expect(page.locator("h1")).toHaveText("VARSITY");
});

test("pointing at XR work lights the XR row and leaves the software row dark", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "XR work" }).hover();
  await page.waitForTimeout(250); // the slot light eases in over 150 ms
  const shadow = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).boxShadow);
  expect(await shadow("[data-row='xr'] .slot")).toContain("rgb(255, 181, 71)");
  expect(await shadow("[data-row='software'] .slot")).not.toContain("rgb(255, 181, 71)");
});
