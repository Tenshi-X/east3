import { test, expect } from "./fixtures";
import { shiftTimes } from "../../shared/life";

test.beforeEach(async ({ mock }) => {
  void mock;
});

test("Android permission denial, test notification, tap routing, and logout", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = {
      granted: false,
      schedules: [] as any[],
      tests: 0,
      listeners: {} as Record<string, (value: any) => void>,
    };
    (window as any).hydrationDevice = state;
    (window as any).androidBridge = {};
    const plugins = ["HydrationReminders", "App", "Keyboard", "PersonalDevice"];
    (window as any).Capacitor = {
      PluginHeaders: plugins.map((name) => ({
        name,
        methods: [
          ...[
            "configure",
            "checkPermission",
            "requestPermission",
            "testNotification",
            "removeListener",
            "hide",
            "status", "reminders",
          ].map((name) => ({ name, rtype: "promise" })),
          { name: "addListener", rtype: "callback" },
        ],
      })),
      nativePromise: async (plugin: string, method: string, options: any) => {
        if(plugin === "PersonalDevice" && method === "status")return {available:true,enabled:false};
        if (method === "checkPermission" || method === "requestPermission")
          return { granted: state.granted };
        if (method === "configure") state.schedules.push(options);
        if (method === "testNotification") state.tests++;
        return {};
      },
      nativeCallback: (
        plugin: string,
        _method: string,
        options: any,
        listener: (value: any) => void,
      ) => {
        state.listeners[`${plugin}:${options.eventName}`] = listener;
        return "test-listener";
      },
    };
  });
  await page.goto("/health");
  const card = page.getByRole("region", {
    name: "Pengingat minum air",
    exact: true,
  });
  await card.getByRole("button", { name: "Aktifkan pengingat minum" }).click();
  await expect(card.getByRole("alert")).toContainText(
    "Izinkan notifikasi Atlas",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("atlas:hydration:user")),
  ).toBeNull();
  await page.evaluate(() => {
    (window as any).hydrationDevice.granted = true;
  });
  await card.getByRole("button", { name: "Aktifkan pengingat minum" }).click();
  await expect(
    card.getByText("Pengingat minum air tersimpan.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as any).hydrationDevice.schedules.at(-1)),
  ).toMatchObject({
    enabled: true,
    userId: "user",
    startMinute: 480,
    endMinute: 1320,
    interval: 120,
    automatic: true,
  });
  await card.getByRole("button", { name: "Tes notifikasi minum" }).click();
  await expect(
    card.getByText(
      "Notifikasi percobaan dikirim. Periksa panel notifikasi HP.",
    ),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).hydrationDevice.tests)).toBe(
    1,
  );
  await page.evaluate(() =>
    (window as any).hydrationDevice.listeners[
      "HydrationReminders:notificationOpened"
    ]({ userId: "user" }),
  );
  await expect(page).toHaveURL(/\/habits$/);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Keluar dari akun" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).hydrationDevice.schedules.at(-1)),
    )
    .toMatchObject({ enabled: false, userId: "" });
});

test("water reminder settings persist and can be disabled from Health", async ({
  page,
}) => {
  await page.goto("/habits");
  const card = page.getByRole("region", {
    name: "Pengingat minum air",
    exact: true,
  });
  await expect(card.getByText("Belum aktif", { exact: true })).toBeVisible();
  await card.getByLabel("Jadwal pengingat").selectOption("manual");
  await expect(card.getByLabel("Mulai pengingat")).toHaveValue("08:00");
  await expect(card.getByLabel("Selesai pengingat")).toHaveValue("22:00");
  // Foreground reminders remain available when browser notifications are blocked.
  await page.evaluate(() => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "denied" },
    });
  });
  await card.getByLabel("Mulai pengingat").fill("22:30");
  await card.getByLabel("Selesai pengingat").fill("06:00");
  await card.getByLabel("Ingatkan setiap").selectOption("90");
  await card.getByRole("button", { name: "Aktifkan pengingat minum" }).click();
  await expect(
    card.getByText("Pengingat minum air tersimpan.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(card.getByLabel("Mulai pengingat")).toHaveValue("22:30");
  await expect(card.getByLabel("Ingatkan setiap")).toHaveValue("90");
  await page.goto("/health");
  await expect(card.getByLabel("Mulai pengingat")).toHaveValue("22:30");
  await card.getByRole("button", { name: "Matikan pengingat minum" }).click();
  await expect(card.getByText("Belum aktif", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("atlas:hydration:user")!).enabled,
    ),
  ).toBe(false);
});

test("invalid active windows do not overwrite the saved reminder", async ({
  page,
}) => {
  await page.goto("/habits");
  const card = page.getByRole("region", {
    name: "Pengingat minum air",
    exact: true,
  });
  await card.getByLabel("Jadwal pengingat").selectOption("manual");
  await card.getByLabel("Mulai pengingat").fill("08:00");
  await card.getByLabel("Selesai pengingat").fill("08:00");
  await card.getByRole("button", { name: "Aktifkan pengingat minum" }).click();
  await expect(card.getByRole("alert")).toContainText(
    "Jam mulai dan selesai harus berbeda.",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("atlas:hydration:user")),
  ).toBeNull();
});

test("a due reminder appears once and stops after disabling", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "atlas:hydration:user",
      JSON.stringify({
        enabled: true,
        mode: "manual",
        start: "08:00",
        end: "22:00",
        interval: 120,
      }),
    );
  });
  // The fixture fixes the local clock at 12:00, one of the default slots.
  await page.goto("/");
  const reminder = page.getByRole("status", {
    name: "Waktunya minum air putih",
  });
  await expect(reminder).toBeVisible();
  await reminder.getByRole("button", { name: "Buka catatan minum" }).click();
  await expect(page).toHaveURL(/\/habits$/);
  await expect(reminder).toHaveCount(0);
  const card = page.getByRole("region", {
    name: "Pengingat minum air",
    exact: true,
  });
  await card.getByRole("button", { name: "Matikan pengingat minum" }).click();
  await expect(card.getByText("Belum aktif", { exact: true })).toBeVisible();
  await expect(reminder).toHaveCount(0);
});

test("automatic mode pauses during recovery sleep and updates after a saved shift change", async ({
  page,
  mock,
}) => {
  mock.tables.shift_assignments = [
    {
      date: "2026-10-16",
      code: "3",
      ...shiftTimes("2026-10-16", "3", "Asia/Jakarta"),
    },
  ];
  await page.goto("/health");
  const card = page.getByRole("region", {
    name: "Pengingat minum air",
    exact: true,
  });
  await expect(card.getByLabel("Jadwal pengingat")).toHaveValue("automatic");
  await expect(card.getByLabel("Mulai pengingat")).toHaveCount(0);
  await card.getByRole("button", { name: "Aktifkan pengingat minum" }).click();
  await expect(card.getByText(/Berikutnya/)).toContainText("15.00");
  await expect(
    page.getByRole("status", { name: "Waktunya minum air putih" }),
  ).toHaveCount(0);
  await page.goto("/shifts");
  await page.getByText("Tambah / ubah satu hari", { exact: true }).click();
  await page.getByLabel("Tanggal shift").fill("2026-10-16");
  await page.getByLabel("Kode shift").selectOption("L");
  await page.getByRole("button", { name: "Simpan perubahan shift" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const schedule = JSON.parse(
          localStorage.getItem("atlas:hydration-schedule:user") || "null",
        );
        return schedule?.windows.some(
          (w: any) => w.start <= Date.now() && Date.now() < w.end,
        );
      }),
    )
    .toBe(true);
  await page.goto("/health");
  await expect(card.getByText(/Berikutnya/)).toContainText("13.00");
  await expect(card.getByText(/Jadwal offline tersimpan/)).toBeVisible();
});

test("automatic mode reschedules when the user saves new sleep preferences", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-17T00:30:00Z"));
  await page.goto("/health");
  const card = page.getByRole("region", {
    name: "Pengingat minum air",
    exact: true,
  });
  await card.getByRole("button", { name: "Aktifkan pengingat minum" }).click();
  await expect(card.getByText(/Berikutnya/)).toContainText("09.00");
  await page.getByLabel("Biasanya bangun").fill("10:00");
  await page.getByLabel("Biasanya tidur").fill("02:00");
  await page
    .getByRole("button", { name: "Simpan profil", exact: true })
    .click();
  await expect(card.getByText(/Berikutnya/)).toContainText("10.00");
});

test("automatic reminders run during night work and disappear when recovery sleep starts", async ({
  page,
  mock,
}) => {
  mock.tables.shift_assignments = [
    {
      date: "2026-10-16",
      code: "3",
      ...shiftTimes("2026-10-16", "3", "Asia/Jakarta"),
    },
  ];
  await page.clock.setFixedTime(new Date("2026-10-16T20:00:00Z")); // 03:00 Jakarta
  await page.goto("/health");
  const card = page.getByRole("region", {
    name: "Pengingat minum air",
    exact: true,
  });
  await card.getByRole("button", { name: "Aktifkan pengingat minum" }).click();
  const reminder = page.getByRole("status", {
    name: "Waktunya minum air putih",
  });
  await expect(reminder).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-10-17T01:00:00Z")); // 08:00 recovery
  await page.evaluate(() =>
    window.dispatchEvent(new Event("atlas:hydration-schedule")),
  );
  await expect(reminder).toHaveCount(0);
});
