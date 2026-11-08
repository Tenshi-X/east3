import { test, expect } from "./fixtures";
import { shiftTimes } from "../../shared/life";

test.beforeEach(async ({ page, mock }) => {
  await page.clock.install({ time: new Date("2026-10-17T05:00:00Z") });
  await page.clock.setSystemTime(new Date("2026-10-17T05:00:00Z"));
});

test("weekly checklist records actual manual duration, updates report and preserves previous weeks", async ({
  page,
  mock,
}) => {
  await page.goto("/workout");
  await expect(page.getByText("0/7 hari")).toBeVisible();
  await page.getByRole("checkbox", { name: "Selesai 2026-10-12" }).click();
  const dialog = page.getByRole("dialog", { name: "Simpan sesi latihan" });
  await dialog.getByLabel("Durasi aktual (menit)").fill("25");
  await dialog
    .getByRole("button", { name: "Simpan sesi", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Selesai 2026-10-12" }),
  ).toBeChecked();
  expect(mock.tables.workout_logs[0].duration_seconds).toBe(1500);
  await page.getByRole("button", { name: "Laporan", exact: true }).click();
  await expect(page.getByText("25 mnt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Minggu sebelumnya" }).click();
  await expect(page.getByText("0 mnt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Minggu berikutnya" }).click();
  await expect(page.getByText("25 mnt", { exact: true })).toBeVisible();
});
test("rest checklist is reversible and contributes no exercise duration", async ({
  page,
  mock,
}) => {
  await page.goto("/workout");
  const rest = page.getByRole("checkbox", { name: "Selesai 2026-10-15" });
  await rest.check();
  await expect(rest).toBeChecked();
  await rest.uncheck();
  await expect(rest).not.toBeChecked();
  expect(mock.tables.workout_logs).toHaveLength(0);
});
test("exercise guide has working images, instructions and original attribution", async ({
  page,
  mock,
}) => {
  await page.goto("/workout");
  await page.getByRole("button", { name: "Gerakan", exact: true }).click();
  await page
    .getByRole("button", { name: /Push-up/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Push-up", exact: true });
  await expect(dialog.getByText(/Jaga pinggul tidak turun/)).toBeVisible();
  await expect
    .poll(() =>
      dialog
        .locator("img")
        .evaluateAll((imgs) =>
          imgs.every((img) => (img as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  await expect(
    dialog.getByRole("link", { name: "CC BY-SA 4.0" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
test("workout timer excludes pause, saves set checklist, survives failed save and retries once", async ({
  page,
  mock,
}) => {
  await page.goto("/workout");
  await page
    .getByRole("button", { name: "Timer workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Mulai timer", exact: true }).click();
  await page.clock.runFor(65000);
  await expect(page.getByRole("timer", { name: "Durasi sesi" })).toHaveText(
    "00:01:05",
  );
  await page
    .getByRole("checkbox", { name: "Set 1", exact: true })
    .first()
    .check();
  await page.getByRole("button", { name: "Jeda", exact: true }).click();
  await page.clock.runFor(30000);
  await expect(page.getByRole("timer")).toHaveText("00:01:05");
  await page.getByRole("button", { name: "Selesai & simpan" }).click();
  mock.fail.add("workout_tracker");
  await page.getByRole("button", { name: "Simpan sesi", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("tidak tersedia");
  mock.fail.delete("workout_tracker");
  await page.getByRole("button", { name: "Simpan sesi", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Simpan sesi latihan" }),
  ).not.toBeVisible();
  expect(mock.tables.workout_logs).toHaveLength(1);
  expect(mock.tables.workout_logs[0].exercise_progress[0].sets[0]).toBe(true);
  expect(mock.tables.workout_logs[0].duration_seconds).toBe(65);
});
test("jogging GPS denial supports manually entered distance and weighted pace", async ({
  page,
  mock,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        watchPosition(_ok: unknown, fail: (e: any) => void) {
          fail({ code: 1 });
          return 1;
        },
        clearWatch() {},
      },
    });
  });
  await page.goto("/workout");
  await page
    .getByRole("button", { name: "Timer jogging", exact: true })
    .click();
  await page.getByRole("button", { name: "Mulai timer", exact: true }).click();
  await expect(page.getByText(/Izin lokasi ditolak/)).toBeVisible();
  await page.clock.runFor(120000);
  await page.getByRole("button", { name: "Selesai & simpan" }).click();
  await page.getByLabel("Jarak (km, opsional)").fill("0.4");
  await page.getByRole("button", { name: "Simpan sesi", exact: true }).click();
  await page.getByRole("button", { name: "Laporan", exact: true }).click();
  await expect(
    page.getByText("5:00 /km", { exact: true }).first(),
  ).toBeVisible();
  expect(mock.tables.workout_logs[0]).toMatchObject({
    distance_meters: 400,
    distance_source: "manual",
    duration_seconds: 120,
  });
});
test("shift recovery, future checks, reload recovery, and phone/tablet/desktop layouts", async ({
  page,
  mock,
}) => {
  mock.tables.shift_assignments.push({
    date: "2026-10-16",
    code: "3",
    ...shiftTimes("2026-10-16", "3", "Asia/Jakarta"),
  });
  await page.goto("/workout");
  await expect(page.getByText(/Selesai shift malam/)).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Selesai 2026-10-18" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Timer workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Mulai timer", exact: true }).click();
  await page.clock.runFor(3000);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Lanjutkan", exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page
        .locator(".screen:not([hidden])")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
  }
});

test("GPS accumulates measured distance, clears the watch when hidden, and never stores coordinates", async ({
  page,
  mock,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        watchPosition(ok: any) {
          (window as any).gpsFix = ok;
          return 8;
        },
        clearWatch() {
          (window as any).gpsCleared = true;
        },
      },
    });
  });
  await page.goto("/workout");
  await page
    .getByRole("button", { name: "Timer jogging", exact: true })
    .click();
  await page.getByRole("button", { name: "Mulai timer", exact: true }).click();
  const fix = (latitude: number) =>
    page.evaluate(
      (lat) =>
        (window as any).gpsFix({
          coords: { latitude: lat, longitude: 106.8, accuracy: 5 },
          timestamp: Date.now(),
        }),
      latitude,
    );
  await fix(-6.2);
  for (let i = 1; i <= 3; i++) {
    await page.clock.runFor(10000);
    await fix(-6.2 + i * 0.0002);
  }
  await expect(page.getByText("0.07 km", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByRole("button", { name: "Lanjutkan", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(10000);
  await expect(page.getByRole("timer")).toHaveText("00:00:30");
  expect(await page.evaluate(() => (window as any).gpsCleared)).toBe(true);
  const stored = await page.evaluate(() =>
    localStorage.getItem("atlas:workout:v1:user"),
  );
  expect(stored).not.toMatch(/latitude|longitude/);
  await page.getByRole("button", { name: "Selesai & simpan" }).click();
  await page.getByRole("button", { name: "Simpan sesi", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Simpan sesi latihan" }),
  ).not.toBeVisible();
  expect(mock.tables.workout_logs[0].distance_meters).toBeGreaterThan(60);
  expect(mock.tables.workout_logs[0].distance_source).toBe("gps");
});

test("visual review of workout, guides, reports, themes and desktop", async ({
  page,
  mock,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/workout");
  await expect(page.getByText("0/7 hari")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("workout-week-mobile.png"),
  });
  await page.getByRole("button", { name: "Gerakan", exact: true }).click();
  await page
    .getByRole("button", { name: /Push-up/ })
    .first()
    .click();
  await page.screenshot({
    path: testInfo.outputPath("workout-guide-mobile.png"),
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Laporan", exact: true }).click();
  await expect(page.getByText("0 mnt", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("workout-report-mobile.png"),
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Mingguan", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("workout-week-desktop.png"),
  });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await page.screenshot({
    path: testInfo.outputPath("workout-week-light.png"),
  });
  expect(errors).toEqual([]);
});
