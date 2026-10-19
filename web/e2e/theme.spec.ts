import { test, expect, mockAPI } from "./fixtures";
import { test as rawTest } from "@playwright/test";

rawTest(
  "dark appearance also covers login and native form controls",
  async ({ page }) => {
    await mockAPI(page, false);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Atlas", exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
    await expect(page.locator(".app-frame")).toHaveCSS(
      "background-color",
      "rgb(16, 23, 34)",
    );
    await expect(page.getByLabel("Email", { exact: true })).toHaveCSS(
      "background-color",
      "rgb(25, 35, 49)",
    );
    await page.screenshot({ path: "test-results/preview-dark-login.png" });
  },
);

test("appearance persists through navigation, reload, system changes and logout", async ({
  page,
  mock,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/profile");
  const choices = page.getByRole("group", { name: "Tema aplikasi" });
  const root = page.locator("html");
  await expect(
    choices.getByRole("button", { name: "Gelap", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/preview-dark-profile.png" });
  await choices.getByRole("button", { name: "Terang", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(page.locator("meta[name=theme-color]")).toHaveAttribute(
    "content",
    "#f8f9fd",
  );
  await page.reload();
  await expect(
    choices.getByRole("button", { name: "Terang", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveAttribute("data-theme", "light");
  await choices
    .getByRole("button", { name: "Ikuti perangkat", exact: true })
    .click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(
    choices.getByRole("button", { name: "Ikuti perangkat", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await choices.getByRole("button", { name: "Gelap", exact: true }).click();
  await page.goto("/calendar?new=1");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.locator(".modal-surface").filter({ visible: true }),
  ).toHaveCSS("background-color", "rgb(25, 35, 49)");
  await expect(page.getByLabel("Judul acara", { exact: true })).toHaveCSS(
    "color",
    "rgb(228, 233, 243)",
  );
  await page.goto("/profile");
  await page.getByRole("button", { name: "Keluar dari akun" }).click();
  await expect(
    page.getByRole("button", { name: "Masuk", exact: true }),
  ).toBeVisible();
  await expect(root).toHaveAttribute("data-theme", "dark");
});
