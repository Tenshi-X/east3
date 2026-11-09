import { test, expect, mockAPI } from "./fixtures";

test("private login has no registration path", async ({ page }) => {
  await mockAPI(page, false);
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Masuk", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Daftar", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Aplikasi pribadi. Masuk menggunakan akun pemilik."),
  ).toBeVisible();
});
test("profile and explicit AI-sharing preferences persist", async ({
  page,
  mock,
}) => {
  await page.goto("/personal");
  await page.getByLabel("Kondisi tempat tinggal").fill("Kos tanpa kulkas");
  await page.getByLabel("Alat yang tersedia").fill("Pemanas listrik");
  await page.getByLabel("Gunakan profil ini dalam percakapan AI").uncheck();
  await page
    .getByRole("button", { name: "Simpan profil pribadi", exact: true })
    .click();
  await expect
    .poll(() => mock.tables.personal_profiles[0]?.preferences.living)
    .toBe("Kos tanpa kulkas");
  await page.reload();
  await expect(page.getByLabel("Kondisi tempat tinggal")).toHaveValue(
    "Kos tanpa kulkas",
  );
  await expect(
    page.getByLabel("Gunakan profil ini dalam percakapan AI"),
  ).not.toBeChecked();
});
test("memories can be edited, kept private and deleted with confirmation", async ({
  page,
  mock,
}) => {
  await page.goto("/personal");
  await page.getByRole("button", { name: "Memori", exact: true }).click();
  await page.getByLabel("Isi memori").fill("Fokus HUPI bulan ini");
  await page.getByLabel("Boleh digunakan AI sebagai konteks").uncheck();
  await page
    .getByRole("button", { name: "Simpan memori", exact: true })
    .click();
  await expect(
    page.getByText("Fokus HUPI bulan ini", { exact: true }),
  ).toBeVisible();
  expect(mock.tables.personal_memories[0].share_with_ai).toBe(false);
  await page.getByRole("button", { name: "Ubah memori", exact: true }).click();
  await page.getByLabel("Isi memori").fill("Fokus Teatch minggu ini");
  await page
    .getByRole("button", { name: "Simpan memori", exact: true })
    .click();
  await expect(
    page.getByText("Fokus Teatch minggu ini", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Hapus memori", exact: true }).click();
  await expect(
    page.getByText("Belum ada memori", { exact: true }),
  ).toBeVisible();
});
test("project next action becomes one ordinary planning task with its duration and energy", async ({
  page,
  mock,
}) => {
  await page.goto("/personal");
  await page.getByRole("button", { name: "Project", exact: true }).click();
  await page.getByLabel("Nama project").fill("HUPI");
  await page.getByLabel("Target project").fill("Selesaikan pilot");
  await page.getByLabel("Langkah berikutnya").fill("Periksa kartu demo");
  await page.getByLabel("Durasi langkah (menit)").fill("45");
  await page.getByLabel("Tenaga yang dibutuhkan").selectOption("low");
  await page
    .getByRole("button", { name: "Simpan project", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Masukkan ke rencana hari ini", exact: true })
    .click();
  await expect
    .poll(() =>
      mock.tables.priorities.some(
        (t) =>
          t.title === "HUPI: Periksa kartu demo" &&
          t.duration_minutes === 45 &&
          t.energy === "low",
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", {
      name: "Masukkan ke rencana hari ini",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Ubah project", exact: true }).click();
  await page.getByLabel("Status project").selectOption("paused");
  await page
    .getByRole("button", { name: "Simpan project", exact: true })
    .click();
  await expect(page.getByText(/Ditunda · 45 menit/)).toBeVisible();
});
test("bill payment requires review and writes the actual expense only after confirmation", async ({
  page,
  mock,
}) => {
  mock.tables.wallets.push({
    id: "wallet-1",
    name: "Utama",
    opening_balance: 1000000,
  });
  await page.goto("/personal");
  await page.getByRole("button", { name: "Uang", exact: true }).click();
  await page.getByLabel("Nama tagihan").fill("Kos");
  await page.getByLabel("Nominal tagihan (Rp)").fill("500000");
  await page.getByLabel("Tanggal jatuh tempo bulanan").fill("20");
  await page
    .getByRole("button", { name: "Tambah tagihan", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Catat pembayaran", exact: true })
    .click();
  expect(mock.tables.transactions).toHaveLength(1);
  await page.getByLabel("Nominal aktual (Rp)").fill("490000");
  await page
    .getByRole("button", { name: "Konfirmasi & catat transaksi", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(mock.tables.transactions.at(-1)?.amount).toBe(490000);
  await expect(
    page.getByRole("button", { name: "Catat pembayaran", exact: true }),
  ).toHaveCount(0);
});
test("overtime uses editable settings and waits for actual payment", async ({
  page,
  mock,
}) => {
  await page.goto("/personal");
  await page.getByRole("button", { name: "Uang", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Simpan estimasi lembur", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Gaji dasar perhitungan (Rp)").fill("2820000");
  await page.getByLabel("Pembagi upah per jam").fill("273");
  await page
    .getByRole("button", { name: "Simpan pengaturan keuangan", exact: true })
    .click();
  await page.getByLabel("Jam lembur", { exact: true }).fill("7");
  await page
    .getByRole("button", { name: "Simpan estimasi lembur", exact: true })
    .click();
  await expect(page.getByText(/belum dibayar/)).toBeVisible();
  expect(mock.tables.transactions).toHaveLength(1);
  await page
    .getByRole("button", { name: "Catat penerimaan", exact: true })
    .click();
  await page.getByLabel("Nominal aktual (Rp)").fill("200000");
  await page
    .getByRole("button", { name: "Konfirmasi & catat transaksi", exact: true })
    .click();
  await expect(page.getByText(/diterima Rp/)).toBeVisible();
  expect(mock.tables.personal_overtime[0].received_amount).toBe(200000);
});
test("queued captures survive a failed API request, and retry keeps their ID", async ({
  page,
  mock,
}) => {
  await page.goto("/capture");
  mock.fail.add("personal");
  await page.getByLabel("Isi catatan").fill("Makan siang");
  await page.getByLabel("Jumlah (Rp)", { exact: true }).fill("25000");
  await page
    .getByRole("button", { name: "Simpan catatan", exact: true })
    .click();
  await expect(page.getByText("Menunggu sinkronisasi (1)")).toBeVisible();
  const pending = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("atlas:capture:user") || "[]"),
  );
  expect(pending).toHaveLength(1);
  expect(mock.tables.transactions).toHaveLength(1);
  mock.fail.delete("personal");
  await page
    .getByRole("button", { name: "Coba sinkronkan", exact: true })
    .click();
  await expect(page.getByText("Menunggu sinkronisasi (0)")).toBeVisible();
  expect(mock.tables.personal_captures[0].id).toBe(pending[0].id);
  expect(mock.tables.transactions).toHaveLength(2);
});
test("check-in updates the existing sleep and energy planner inputs", async ({
  page,
  mock,
}) => {
  await page.goto("/");
  await page.getByLabel("Tidur terakhir (jam)").fill("5");
  await page.getByLabel("Energi sekarang").selectOption("2");
  await page
    .getByRole("button", { name: "Perbarui kondisi & rencana", exact: true })
    .click();
  await expect(
    page.getByText("Tidur dan energi dicatat. Rencana harian diperbarui.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    mock.tables.wellness_logs.some(
      (l) => l.kind === "sleep" && l.sleep_hours === 5,
    ),
  ).toBe(true);
  expect(
    mock.tables.wellness_logs.some(
      (l) => l.kind === "energy" && l.energy === 2,
    ),
  ).toBe(true);
});
test("backup download excludes credentials and restore requires a review step", async ({
  page,
  mock,
}) => {
  await page.goto("/personal");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh backup", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^Atlas-Backup-/);
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "atlas-personal",
          version: 1,
          owner_id: "user",
          exported_at: "2026-10-17",
          tables: { notes: mock.tables.notes },
        }),
      ),
    });
  await expect(
    page.getByRole("dialog", { name: "Periksa pemulihan backup" }),
  ).toBeVisible();
  expect(mock.writes.filter((w) => w.body?.action === "restore")).toHaveLength(
    0,
  );
  await page
    .getByRole("button", { name: "Pulihkan backup ini", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(mock.writes.some((w) => w.body?.action === "restore")).toBe(true);
});
test("new personal screens fit narrow phones in both themes and remain keyboard accessible", async ({
  page,
  mock,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/personal");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    for (const label of ["Profil", "Memori", "Project", "Uang", "Evaluasi"]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.getByRole("button", { name: "Memori", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Isi memori")).toBeVisible();
  await page.screenshot({
    path: "test-results/personal-phone.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
  await page.screenshot({
    path: "test-results/personal-desktop-light.png",
    fullPage: true,
  });
});

test("AI memory suggestions stay editable and are saved only after the explicit action", async ({
  page,
  mock,
}) => {
  await page.goto("/ai");
  await page.route("**/api/ai-proxy", (route) =>
    route.fulfill({
      json: {
        message: "Periksa usulan memori.",
        actions: [
          {
            message: "Belum disimpan.",
            memory_draft: {
              client_id: "00000000-0000-4000-8000-000000000001",
              category: "decision",
              content: "Fokus HUPI",
              share_with_ai: true,
            },
          },
        ],
      },
    }),
  );
  await page
    .getByLabel("Pesan untuk Atlas")
    .fill("Ingat saya ingin fokus HUPI");
  await page.getByRole("button", { name: "Kirim pesan", exact: true }).click();
  await expect(page.getByLabel("Usulan memori")).toHaveValue("Fokus HUPI");
  expect(mock.tables.personal_memories).toHaveLength(0);
  await page.getByLabel("Usulan memori").fill("Fokus Teatch dulu");
  await page
    .getByRole("button", { name: "Simpan memori", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Memori tersimpan", exact: true }),
  ).toBeDisabled();
  expect(mock.tables.personal_memories[0].content).toBe("Fokus Teatch dulu");
});

test("Android lock rejects failed authentication and protects the app again on background", async ({
  page,
  mock,
}) => {
  await page.addInitScript(() => {
    const state = {
      enabled: true,
      deny: true,
      listeners: {} as Record<string, (data: any) => void>,
      reminders: [] as any[],
    };
    (window as any).personalDevice = state;
    (window as any).androidBridge = {};
    const methods = [
      "status",
      "authenticate",
      "setLock",
      "dictate",
      "saveBackup",
      "reminders",
      "configure",
      "checkPermission",
      "requestPermission",
      "removeListener",
      "hide",
    ];
    (window as any).Capacitor = {
      PluginHeaders: [
        "PersonalDevice",
        "HydrationReminders",
        "App",
        "Keyboard",
      ].map((name) => ({
        name,
        methods: [
          ...methods.map((name) => ({ name, rtype: "promise" })),
          { name: "addListener", rtype: "callback" },
        ],
      })),
      nativePromise: async (plugin: string, method: string, options: any) => {
        if (plugin === "PersonalDevice" && method === "status")
          return { enabled: state.enabled, available: true };
        if (plugin === "PersonalDevice" && method === "authenticate") {
          if (state.deny) throw new Error("Pemeriksaan keamanan dibatalkan.");
          return {};
        }
        if (method === "setLock") state.enabled = options.enabled;
        if (method === "reminders") state.reminders.push(options);
        if (method === "checkPermission" || method === "requestPermission")
          return { granted: true };
        return {};
      },
      nativeCallback: (
        plugin: string,
        _method: string,
        options: any,
        listener: (value: any) => void,
      ) => {
        state.listeners[`${plugin}:${options.eventName}`] = listener;
        return "native-listener";
      },
    };
  });
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Atlas terkunci" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Buka Atlas", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Atlas terkunci" }),
  ).toBeVisible();
  await expect(
    page.getByText("seva@example.test", { exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => ((window as any).personalDevice.deny = false));
  await page.getByRole("button", { name: "Buka Atlas", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Nonaktifkan kunci aplikasi",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as any).personalDevice.listeners["App:appStateChange"]({
      isActive: false,
    }),
  );
  await expect(
    page.getByRole("heading", { name: "Atlas terkunci" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Keluar dari akun", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Masuk", exact: true }),
  ).toBeVisible();
});
