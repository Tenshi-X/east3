import { test, expect } from "./fixtures";

for (const [width, theme] of [
  [320, "dark"],
  [390, "light"],
  [768, "dark"],
  [1280, "light"],
] as const) {
  test(`daily overview and navigation at ${width}px in ${theme}`, async ({
    page,
    mock,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(
      (value) => localStorage.setItem("east3_theme", value),
      theme,
    );
    await page.goto("/");
    const overview = page.getByRole("region", {
      name: "Harimu, satu per satu.",
    });
    await expect(
      overview.getByRole("img", { name: "Prioritas selesai: 0 dari 5" }),
    ).toBeVisible();
    await expect(overview).toContainText("5 prioritas masih menunggu");
    await expect(
      page.getByRole("status", { name: "Memuat", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/overview-${width}-${theme}.png`,
    });

    await overview.getByRole("link", { name: "0/1 kebiasaan" }).click();
    await expect(
      page.getByRole("heading", { name: "Kebiasaan", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Kembali", exact: true }).click();
    await page.getByRole("link", { name: "Ruang Saya", exact: true }).click();
    await page.screenshot({ path: `test-results/space-${width}-${theme}.png` });
    await page.getByRole("button", { name: /Workout Program/ }).click();
    await expect(
      page.getByRole("heading", { name: "Workout", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Kembali", exact: true }).click();
    await page.getByRole("link", { name: "Beranda", exact: true }).click();
    await page
      .getByRole("button", {
        name: `Gunakan tema ${theme === "dark" ? "terang" : "gelap"}`,
      })
      .click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      theme === "dark" ? "light" : "dark",
    );
    await overview.getByRole("link", { name: "1 agenda" }).click();
    await expect(
      page.getByRole("heading", { name: "Kalender", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Beranda", exact: true }).click();
    await overview.getByRole("link", { name: "Keuangan bulan ini" }).click();
    await expect(
      page.getByRole("heading", { name: "Keuangan", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Beranda", exact: true }).click();
    await overview
      .getByRole("button", { name: "Lihat rencana", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Rencana hari ini", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Kembali", exact: true }).click();
    expect(errors).toEqual([]);
  });
}

test("daily ring follows task completion and rollback without another request", async ({
  page,
  mock,
}) => {
  await page.goto("/");
  const ring = page.locator(".day-overview .progress-ring");
  await expect(ring).toHaveAttribute(
    "aria-label",
    "Prioritas selesai: 0 dari 5",
  );
  await page
    .getByRole("button", { name: "Selesaikan Prioritas 1", exact: true })
    .click();
  await expect(ring).toHaveAttribute(
    "aria-label",
    "Prioritas selesai: 1 dari 5",
  );
  mock.fail.add("priorities");
  await page
    .getByRole("button", { name: "Selesaikan Prioritas 2", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Layanan sedang tidak tersedia" }),
  ).toBeVisible();
  await expect(ring).toHaveAttribute(
    "aria-label",
    "Prioritas selesai: 1 dari 5",
  );
});

test("overview distinguishes unavailable resources from an empty day", async ({
  page,
  mock,
}) => {
  mock.fail.add("priorities");
  mock.fail.add("habits");
  await page.goto("/");
  const overview = page.locator(".day-overview");
  await expect(overview).toContainText("Prioritas belum dapat dimuat");
  await expect(overview.getByRole("img")).toHaveCount(0);
  await expect(
    overview.getByRole("link", { name: "- kebiasaan" }),
  ).toBeVisible();
  await expect(overview.getByRole("link", { name: "1 agenda" })).toBeVisible();
  mock.fail.clear();
  mock.tables.priorities = [];
  await page.reload();
  await expect(overview).toContainText("Belum ada prioritas");
  await expect(
    overview.getByRole("img", { name: "Prioritas selesai: 0 dari 0" }),
  ).toBeVisible();
});

test("keyboard use of offscreen cards keeps app navigation in view", async ({
  page,
  mock,
}) => {
  await page.goto("/");
  const track = page.getByLabel("Kartu Aktivitas hari ini", { exact: true });
  await track.focus();
  await track.press("ArrowRight");
  await expect(
    page.getByRole("heading", { name: "Prioritas", exact: true }),
  ).toBeInViewport();
  await expect(page.locator(".app-bar")).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("navigation", { name: "Navigasi utama" }),
  ).toBeInViewport({ ratio: 1 });
});
