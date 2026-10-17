import { test, expect } from "./fixtures";

test("reading template supports custom targets and steps", async ({
  page,
  mock,
}) => {
  mock.tables.habits = [];
  await page.goto("/habits");
  await page.getByRole("button", { name: /Membaca Luangkan waktu/ }).click();
  const dialog = page.getByRole("dialog", { name: "Kebiasaan baru" });
  await expect(
    dialog.getByLabel("Target per hari", { exact: true }),
  ).toHaveValue("15");
  await dialog.getByLabel("Target per hari", { exact: true }).fill("10");
  await expect(
    dialog.getByLabel("Jumlah per ketukan", { exact: true }),
  ).toHaveValue("5");
  await dialog.getByRole("button", { name: "Simpan kebiasaan" }).click();
  await expect(dialog).not.toBeVisible();
  const progress = page.getByRole("progressbar", {
    name: "Progres Membaca",
    exact: true,
  });
  const add = page.getByRole("button", {
    name: "Tambah 5 menit Membaca",
    exact: true,
  });
  await add.click();
  await expect(progress).toHaveAttribute("aria-valuenow", "5");
  await add.click();
  await expect(progress).toHaveAttribute("aria-valuenow", "10");
  await expect(
    page.getByRole("button", {
      name: "Batalkan check-in Membaca",
      exact: true,
    }),
  ).toBeVisible();
  expect(mock.tables.habits[0]).toMatchObject({
    target_value: 10,
    step_value: 5,
    unit: "menit",
  });
});

test("wallet balances, transaction assignment, filtering and safe deletion", async ({
  page,
  mock,
}) => {
  await page.goto("/finance");
  await page.getByRole("button", { name: "Kantong", exact: true }).click();
  for (const [name, type, balance] of [
    ["GoPay", "ewallet", "100000"],
    ["BCA", "bank", "1000000"],
  ]) {
    await page
      .getByRole("button", { name: "Kantong baru", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Kantong baru" });
    await dialog.getByLabel("Nama kantong", { exact: true }).fill(name);
    await dialog
      .getByRole("combobox", { name: "Jenis kantong", exact: true })
      .selectOption(type);
    await dialog.getByLabel("Saldo awal (Rp)").fill(balance);
    await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  }
  const [gopay, bank] = mock.tables.wallets;
  await page.getByRole("button", { name: "Transaksi", exact: true }).click();
  await page
    .getByRole("button", { name: "Ubah transaksi Makan siang" })
    .click();
  let dialog = page.getByRole("dialog", { name: "Ubah transaksi" });
  await dialog
    .getByRole("combobox", { name: /^Kantong/ })
    .selectOption(gopay.id);
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(mock.tables.transactions[0].wallet_id).toBe(gopay.id);
  await page
    .getByRole("button", { name: "Transaksi baru", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Transaksi baru" });
  await dialog.getByRole("button", { name: "Pemasukan", exact: true }).click();
  await dialog.getByLabel("Jumlah (Rp)", { exact: true }).fill("500000");
  await dialog
    .getByRole("combobox", { name: /^Kantong/ })
    .selectOption(bank.id);
  await dialog.getByLabel("Catatan (opsional)").fill("Gaji tes");
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("Filter kantong").selectOption(gopay.id);
  await expect(page.getByText("Makan siang", { exact: true })).toBeVisible();
  await expect(page.getByText("Gaji tes", { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Kantong", exact: true }).click();
  const walletCard = (name: string) =>
    page
      .locator(".card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(walletCard("GoPay")).toContainText(/75.000/);
  await expect(walletCard("BCA")).toContainText(/1.500.000/);
  await page.getByLabel("Periode", { exact: true }).fill("2026-09");
  await expect(walletCard("GoPay")).toContainText(/75.000/);
  await page
    .getByRole("button", { name: "Hapus kantong GoPay", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hapus", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Kantong masih memiliki transaksi",
  );
  expect(mock.tables.wallets).toHaveLength(2);
  expect(mock.tables.transactions).toHaveLength(2);
  await page.screenshot({ path: "test-results/wallets-mobile.png" });
});

test("water template persists preferences and daily incremental progress", async ({
  page,
  mock,
}) => {
  await page.goto("/habits?new=1");
  let dialog = page.getByRole("dialog", { name: "Kebiasaan baru" });
  await dialog.getByLabel("Template kebiasaan").selectOption("water");
  await expect(dialog.getByLabel("Target air per hari (gelas)")).toHaveValue(
    "8",
  );
  await dialog
    .getByText("Preferensi tubuh & perkiraan target", { exact: true })
    .click();
  await dialog.getByLabel("Tinggi badan (cm, opsional)").fill("170");
  await dialog.getByLabel("Berat badan (kg, opsional)").fill("70");
  await dialog
    .getByRole("button", { name: "Gunakan perkiraan berat badan" })
    .click();
  await expect(dialog.getByLabel("Target air per hari (gelas)")).toHaveValue(
    "8.4",
  );
  await dialog.getByLabel("Catat air dalam").selectOption("liters");
  await expect(dialog.getByLabel("Target air per hari (liter)")).toHaveValue(
    "2.1",
  );
  mock.fail.add("habits");
  await dialog.getByRole("button", { name: "Simpan kebiasaan" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("Berat badan (kg, opsional)")).toHaveValue(
    "70",
  );
  mock.fail.delete("habits");
  await dialog.getByRole("button", { name: "Simpan kebiasaan" }).click();
  await expect(dialog).not.toBeVisible();
  const water = mock.tables.habits.find((h) => h.name === "Minum air putih");
  expect(water).toMatchObject({
    target_value: 2100,
    unit: "ml",
    step_value: 250,
    settings: {
      template: "water",
      height_cm: 170,
      weight_kg: 70,
      display_unit: "liters",
      glass_ml: 250,
    },
  });
  const add = page.getByRole("button", {
    name: "Tambah 1 gelas (250 ml) Minum air putih",
    exact: true,
  });
  const progress = page.getByRole("progressbar", {
    name: "Progres Minum air putih",
    exact: true,
  });
  for (let i = 1; i <= 9; i++) {
    await add.click();
    await expect(progress).toHaveAttribute(
      "aria-valuenow",
      String(Math.min(2100, i * 250)),
    );
  }
  await expect(
    page.getByRole("button", {
      name: "Batalkan check-in Minum air putih",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Kurangi 1 gelas (250 ml) Minum air putih",
      exact: true,
    })
    .click();
  await expect(progress).toHaveAttribute("aria-valuenow", "2000");
  await expect(
    page.getByRole("button", { name: "Check-in Minum air putih", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(progress).toHaveAttribute("aria-valuenow", "2000");
  await page
    .getByRole("button", { name: "Ubah Minum air putih", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Ubah kebiasaan" });
  await expect(dialog.getByLabel("Target air per hari (liter)")).toHaveValue(
    "2.1",
  );
  await dialog
    .getByText("Preferensi tubuh & perkiraan target", { exact: true })
    .click();
  await expect(dialog.getByLabel("Berat badan (kg, opsional)")).toHaveValue(
    "70",
  );
  await dialog.getByRole("button", { name: "Tutup", exact: true }).click();
  await page.clock.setFixedTime(new Date("2026-10-18T05:00:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  expect(
    mock.tables.habit_logs.find(
      (l) => l.habit_id === water.id && l.date === "2026-10-17",
    )?.value,
  ).toBe(2000);
  await page.screenshot({ path: "test-results/habits-mobile.png" });
});

test("cancelled transaction editing cannot prefill a new quick expense", async ({
  page,
  mock,
}) => {
  await page.goto("/finance");
  await page
    .getByRole("button", { name: "Ubah transaksi Makan siang" })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Jumlah (Rp)", { exact: true })
    .fill("99000");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Tutup", exact: true })
    .click();
  await page.getByRole("link", { name: "Beranda", exact: true }).click();
  await page.getByRole("button", { name: "Tambah", exact: true }).click();
  await page.getByRole("button", { name: "Pengeluaran", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Transaksi baru" });
  await expect(dialog.getByLabel("Jumlah (Rp)", { exact: true })).toHaveValue(
    "",
  );
  await expect(dialog.getByLabel("Catatan (opsional)")).toHaveValue("");
  expect(mock.writes).toHaveLength(0);
});

test("habit counters on the dashboard share persisted progress and retain values after errors", async ({
  page,
  mock,
}) => {
  mock.tables.habits = [
    {
      id: "water",
      name: "Air putih",
      target_value: 500,
      unit: "ml",
      step_value: 250,
      settings: { template: "water", glass_ml: 250 },
    },
  ];
  await page.goto("/");
  const add = page.getByRole("button", {
    name: "Tambah 1 gelas (250 ml) Air putih",
    exact: true,
  });
  const progress = page.getByRole("progressbar", {
    name: "Progres Air putih",
    exact: true,
  });
  await add.click();
  await expect(progress).toHaveAttribute("aria-valuenow", "250");
  mock.fail.add("habit_logs");
  await add.click();
  await expect(page.getByRole("status")).toContainText(
    "Layanan sedang tidak tersedia",
  );
  await expect(progress).toHaveAttribute("aria-valuenow", "250");
  mock.fail.delete("habit_logs");
  await add.click();
  await expect(progress).toHaveAttribute("aria-valuenow", "500");
  await page.goto("/habits");
  await expect(progress).toHaveAttribute("aria-valuenow", "500");
  await page
    .getByRole("button", { name: "Batalkan check-in Air putih", exact: true })
    .click();
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await expect(
    page.getByRole("button", {
      name: "Kurangi 1 gelas (250 ml) Air putih",
      exact: true,
    }),
  ).toBeDisabled();
});

for (const width of [320, 390, 600]) {
  test(`new forms fit at ${width}px`, async ({ page, mock }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/finance?new=1&kind=wallet", "/habits?new=1"]) {
      await page.goto(path);
      const dialog = page.getByRole("dialog");
      if (path.startsWith("/habits")) {
        await dialog.getByLabel("Template kebiasaan").selectOption("water");
        await dialog
          .getByText("Preferensi tubuh & perkiraan target", { exact: true })
          .click();
      }
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBeTruthy();
      await dialog
        .getByRole("button", { name: /^Simpan/ })
        .scrollIntoViewIfNeeded();
      await expect(
        dialog.getByRole("button", { name: /^Simpan/ }),
      ).toBeInViewport();
      if (width === 390)
        await page.screenshot({
          path: `test-results/${path.startsWith("/habits") ? "water-form" : "wallet-form"}.png`,
        });
    }
  });
}
