import { test, expect, mockAPI } from "./fixtures";
test("navigation, previews, tab state and scroll persist", async ({
  page,
  mock,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hari ini", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Prioritas 4", { exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Lihat semua", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toContainText("Prioritas 5");
  await page.getByRole("button", { name: "Tutup", exact: true }).click();
  await page
    .locator('[data-screen="/"] .screen-scroll')
    .evaluate((el) => (el.scrollTop = 500));
  const scroll = await page
    .locator('[data-screen="/"] .screen-scroll')
    .evaluate((el) => el.scrollTop);
  await page.getByRole("link", { name: "Kalender", exact: true }).click();
  await page
    .getByLabel("Tampilan kalender")
    .getByRole("button", { name: "Bulan", exact: true })
    .click();
  await page.getByRole("link", { name: "Beranda", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('[data-screen="/"] .screen-scroll')
        .evaluate((el) => el.scrollTop),
    )
    .toBe(scroll);
  await page.getByRole("link", { name: "Kalender", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Bulan", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Ruang Saya", exact: true }).click();
  await page.getByRole("button", { name: /Kebiasaan Langkah/ }).click();
  await expect(
    page.getByRole("heading", { name: "Kebiasaan", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).not.toBeVisible();
  await page.getByRole("button", { name: "Kembali", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ruang Saya", exact: true }),
  ).toBeVisible();
});
for (const action of [
  {
    label: "Tugas baru",
    dialog: "Tugas baru",
    field: "Apa yang perlu diselesaikan?",
    value: "Tugas tes",
    save: "Simpan tugas",
    table: "priorities",
  },
  {
    label: "Acara baru",
    dialog: "Acara baru",
    field: "Judul acara",
    value: "Acara tes",
    save: "Simpan acara",
    table: "events",
  },
  {
    label: "Pengeluaran",
    dialog: "Transaksi baru",
    field: "Jumlah (Rp)",
    value: "45000",
    save: "Simpan",
    table: "transactions",
  },
  {
    label: "Catatan baru",
    dialog: "Catatan baru",
    field: "Judul",
    value: "Catatan tes",
    save: "Simpan catatan",
    table: "notes",
  },
]) {
  test(`quick action: ${action.label}, failed save keeps draft`, async ({
    page,
    mock,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Tambah", exact: true }).click();
    await page.getByRole("button", { name: action.label, exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: action.dialog,
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(action.field, { exact: true }).fill(action.value);
    mock.fail.add(action.table);
    await dialog
      .getByRole("button", { name: action.save, exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByLabel(action.field, { exact: true })).toHaveValue(
      action.value,
    );
    mock.fail.delete(action.table);
    await dialog
      .getByRole("button", { name: action.save, exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    expect(
      mock.writes.some((w) => w.table === action.table && w.method === "POST"),
    ).toBeTruthy();
    if (action.table === "events") {
      await page
        .getByRole("button", { name: "Acara baru", exact: true })
        .click();
      await expect(dialog).toBeVisible();
    }
  });
}
test("budget form cannot leak into quick expense action", async ({
  page,
  mock,
}) => {
  await page.goto("/finance");
  await page
    .getByRole("button", { name: "Transaksi baru", exact: true })
    .click();
  await page.getByRole("button", { name: "Pemasukan", exact: true }).click();
  await page.getByRole("button", { name: "Tutup", exact: true }).click();
  await page.getByRole("button", { name: "Anggaran", exact: true }).click();
  await page
    .getByRole("button", { name: "Anggaran baru", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Anggaran bulanan" }),
  ).toBeVisible();
  await page.goBack();
  await page.getByRole("link", { name: "Beranda", exact: true }).click();
  await page.getByRole("button", { name: "Tambah", exact: true }).click();
  await page.getByRole("button", { name: "Pengeluaran", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Transaksi baru" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pengeluaran", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("delete requires confirmation; habit check-in and undo preserve payload", async ({
  page,
  mock,
}) => {
  await page.goto("/habits");
  await page
    .getByRole("button", { name: "Check-in Minum air", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Batalkan check-in Minum air",
      exact: true,
    }),
  ).toBeVisible();
  let write = mock.writes.find((w) => w.table === "habit_logs");
  expect(write?.body.row).toMatchObject({
    value: 2,
    is_completed: true,
    date: "2026-10-17",
  });
  await page
    .getByRole("button", { name: "Batalkan check-in Minum air", exact: true })
    .click();
  await expect
    .poll(() => mock.writes.filter((w) => w.table === "habit_logs").length)
    .toBe(2);
  expect(
    mock.writes.filter((w) => w.table === "habit_logs")[1].body.row,
  ).toMatchObject({ value: 0, is_completed: false });
  await page.getByRole("button", { name: "Hapus Minum air" }).click();
  expect(mock.writes.filter((w) => w.method === "DELETE")).toHaveLength(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Batal", exact: true })
    .click();
  await expect(page.getByText("Minum air", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hapus Minum air" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hapus", exact: true })
    .click();
  await expect
    .poll(() => mock.writes.filter((w) => w.method === "DELETE").length)
    .toBe(1);
});
test("workout program and session use schema-compatible payloads, isolate program fields", async ({
  page,
  mock,
}) => {
  await page.goto("/workout");
  await page.getByRole("button", { name: "Program baru" }).click();
  let dialog = page.getByRole("dialog", { name: "Program latihan baru" });
  await dialog.getByLabel("Nama program").fill("Program tes");
  await dialog.getByRole("button", { name: "Simpan program" }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    mock.writes.find((w) => w.table === "workout_plans")?.body.day_of_week,
  ).toEqual([1]);
  await page.getByRole("button", { name: /Push A.*Catat latihan/ }).click();
  dialog = page.getByRole("dialog", { name: "Push A" });
  await dialog.getByLabel("Nama latihan (opsional)").fill("Bench Press");
  await dialog.getByRole("button", { name: "Tutup", exact: true }).click();
  await page.getByRole("button", { name: /Pull B.*Catat latihan/ }).click();
  await expect(page.getByLabel("Nama latihan (opsional)")).toHaveValue("");
  await page.getByLabel("Nama latihan (opsional)").fill("Row");
  await page
    .getByRole("button", { name: "Simpan latihan", exact: true })
    .click();
  await expect
    .poll(() => mock.writes.filter((w) => w.table === "workout_sets").length)
    .toBe(1);
  expect(
    mock.writes.find((w) => w.table === "workout_logs")?.body,
  ).toMatchObject({ plan_id: "plan-2", date: "2026-10-17" });
  expect(
    mock.writes.find((w) => w.table === "workout_sets")?.body,
  ).toMatchObject({ exercise_name: "Row", reps: 10, weight: 0, set_number: 1 });
});
test("AI history, multiline composer, failed text/image send and retry", async ({
  page,
  mock,
}) => {
  await page.goto("/ai");
  await expect(page.getByRole("log")).toContainText(
    "Halo, ada yang bisa dibantu?",
  );
  const composer = page.getByLabel("Pesan untuk Atlas");
  await composer.fill("Baris satu\nBaris dua");
  await page.locator("input[type=file]").setInputFiles({
    name: "gambar.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5n8AAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByAltText("Pratinjau lampiran")).toBeVisible();
  mock.fail.add("/api/ai-proxy");
  await page.getByRole("button", { name: "Kirim pesan" }).click();
  await expect(page.getByRole("alert")).toContainText("Draf tetap tersedia");
  await expect(composer).toHaveValue("Baris satu\nBaris dua");
  await expect(page.getByAltText("Pratinjau lampiran")).toBeVisible();
  mock.fail.clear();
  await page.getByRole("button", { name: "Kirim pesan" }).click();
  await expect(page.getByRole("log")).toContainText("Sudah saya bantu.");
  await expect(composer).toBeEmpty();
  expect(mock.writes.find((w) => w.table === "ai")?.body.image).toContain(
    "data:image/png;base64,",
  );
  const rect = await composer.boundingBox();
  await page.setViewportSize({ width: 390, height: 460 });
  await expect(composer).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Kirim pesan" }),
  ).toBeInViewport();
  expect(rect).not.toBeNull();
});
test("home sections fail independently", async ({ page, mock }) => {
  mock.fail.add("events");
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Layanan sedang tidak tersedia",
  );
  await expect(
    page.getByText("Prioritas 1", { exact: true }).first(),
  ).toBeVisible();
});
test("note preview opens complete detail and editor draft survives closing", async ({
  page,
  mock,
}) => {
  await page.goto("/notes");
  await page.getByRole("button", { name: /Ide pertama/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Baris ketiga yang tetap ada pada detail",
  );
  await page.getByRole("button", { name: "Tutup", exact: true }).click();
  await page.getByRole("button", { name: "Catatan baru", exact: true }).click();
  await page.getByLabel("Isi catatan").fill("Draf panjang");
  await page.getByRole("button", { name: "Tutup", exact: true }).click();
  await page.getByRole("button", { name: "Catatan baru", exact: true }).click();
  await expect(page.getByLabel("Isi catatan")).toHaveValue("Draf panjang");
});
for (const width of [320, 360, 390, 412, 600])
  test(`layout ${width}px, long text, no overflow or undersized controls`, async ({
    page,
    mock,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    mock.tables.transactions[0].amount = 9876543210123;
    mock.tables.habits[0].name =
      "Kebiasaan dengan nama yang sangat panjang agar tetap terbaca di layar kecil";
    for (const path of [
      "/",
      "/calendar",
      "/finance",
      "/ai",
      "/space",
      "/habits",
      "/workout",
      "/notes",
      "/profile",
    ]) {
      await page.goto(path);
      await expect(page.locator(".app-bar h1")).toBeVisible();
      await expect(
        page.getByRole("status", { name: "Memuat", exact: true }),
      ).toHaveCount(0);
      const issues = await page.evaluate(() => {
        const screen = document.querySelector(".screen:not([hidden])")!;
        return {
          overflow: screen.scrollWidth > screen.clientWidth + 1,
          small: [...document.querySelectorAll("button,a")]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return (
                r.width > 0 &&
                r.height > 0 &&
                !el.closest("dialog:not([open]),[hidden]") &&
                (r.width < 47 || r.height < 47)
              );
            })
            .map((el) => ({
              text: el.getAttribute("aria-label") || el.textContent,
              width: el.getBoundingClientRect().width,
              height: el.getBoundingClientRect().height,
            })),
        };
      });
      expect(issues, `${path} at ${width}`).toEqual({
        overflow: false,
        small: [],
      });
    }
  });
test("large text and landscape keep form and navigation accessible", async ({
  page,
  mock,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/calendar?new=1");
  await page.addStyleTag({ content: ":root{font-size:32px!important}" });
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Judul acara")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Simpan acara" })
    .scrollIntoViewIfNeeded();
  await expect(
    dialog.getByRole("button", { name: "Simpan acara" }),
  ).toBeInViewport();
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBeTruthy();
});

import { test as rawTest } from "@playwright/test";
rawTest(
  "login has persistent labels, password visibility and autofill",
  async ({ page }) => {
    await mockAPI(page, false);
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Atlas", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill("seva@example.test");
    await page.getByLabel("Kata sandi", { exact: true }).fill("rahasia123");
    await page.getByRole("button", { name: "Tampilkan kata sandi" }).click();
    await expect(
      page.getByLabel("Kata sandi", { exact: true }),
    ).toHaveAttribute("type", "text");
    await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute(
      "autocomplete",
      "email",
    );
    await page.setViewportSize({ width: 320, height: 400 });
    await page
      .getByRole("button", { name: "Masuk", exact: true })
      .scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Hari ini", exact: true }),
    ).toBeVisible();
  },
);
test("visual review captures primary screens and editor", async ({
  page,
  mock,
}) => {
  for (const [name, path] of Object.entries({
    home: "/",
    calendar: "/calendar",
    finance: "/finance",
    ai: "/ai",
    space: "/space",
    editor: "/notes?new=1",
  })) {
    await page.goto(path);
    await expect(page.locator(".app-bar h1")).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Memuat", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({ path: `test-results/preview-${name}.png` });
  }
});

test("positive fractional amounts retain the existing API contract", async ({
  page,
  mock,
}) => {
  await page.goto("/finance?new=1");
  const dialog = page.getByRole("dialog", { name: "Transaksi baru" });
  await dialog.getByLabel("Jumlah (Rp)", { exact: true }).fill("12500.5");
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    mock.writes.find((write) => write.table === "transactions")?.body.amount,
  ).toBe(12500.5);
});
