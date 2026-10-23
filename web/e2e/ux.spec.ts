import { test, expect } from "./fixtures";

for (const fail of [false, true]) {
  test(`AI clears the composer while waiting and ${fail ? "restores a failed draft" : "keeps a successful message"}`, async ({
    page,
    mock,
  }) => {
    await page.goto("/ai");
    const input = page.getByLabel("Pesan untuk Atlas");
    await expect(input).toBeEnabled();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/ai-proxy", async (route) => {
      await gate;
      await route.fulfill({
        status: fail ? 503 : 200,
        json: fail
          ? { error: "Service indisponible" }
          : { reply: "Jawaban tes." },
      });
    });
    await input.fill("  Rencana hari ini\nTolong bantu  ");
    await page.locator("input[type=file]").setInputFiles({
      name: "gambar.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5n8AAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(page.getByAltText("Pratinjau lampiran")).toBeVisible();
    await page.getByRole("button", { name: "Kirim pesan" }).click();
    try {
      await expect(input).toBeEmpty();
      await expect(input).toHaveAttribute(
        "placeholder",
        "Menunggu jawaban Atlas…",
      );
      await expect(page.getByAltText("Pratinjau lampiran")).toHaveCount(0);
      await expect(page.getByAltText("Gambar yang dikirim")).toBeVisible();
      await expect(page.locator(".bubble.user")).toHaveCount(1);
      await expect(page.locator(".chat-processing")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Kirim pesan" }),
      ).toBeDisabled();
      await page.screenshot({ path: `test-results/chat-pending-${fail}.png` });
    } finally {
      release();
    }
    await expect(page.locator(".chat-processing")).toHaveCount(0);
    if (fail) {
      await expect(input).toHaveValue("  Rencana hari ini\nTolong bantu  ");
      await expect(page.getByAltText("Pratinjau lampiran")).toBeVisible();
      await expect(page.locator(".bubble.user")).toHaveCount(0);
      await expect(page.getByRole("alert")).toContainText(
        "Draf tetap tersedia",
      );
    } else {
      await expect(input).toBeEmpty();
      await expect(page.getByRole("log")).toContainText("Jawaban tes.");
      await expect(page.locator(".bubble.user")).toHaveCount(1);
    }
  });
}

for (const width of [320, 390, 960]) {
  test(`home cards scroll horizontally and remain usable at ${width}px`, async ({
    page,
    mock,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const group = page.getByRole("region", {
      name: "Aktivitas hari ini",
      exact: true,
    });
    // A named section exposes an accessible region.
    const track = group.getByLabel("Kartu Aktivitas hari ini", { exact: true });
    await expect(
      page.getByRole("status", { name: "Memuat", exact: true }),
    ).toHaveCount(0);
    expect(
      await track.evaluate((el) => el.scrollWidth > el.clientWidth),
    ).toBeTruthy();
    await group.scrollIntoViewIfNeeded();
    const next = group.getByRole("button", {
      name: "Kartu berikutnya: Aktivitas hari ini",
    });
    await next.click();
    await expect
      .poll(() => track.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(100);
    const priority = group.getByRole("heading", {
      name: "Prioritas",
      exact: true,
    });
    await expect(priority).toBeInViewport({ ratio: 0.95 });
    await group
      .getByRole("button", { name: "Selesaikan Prioritas 1", exact: true })
      .click();
    await expect(
      group.getByRole("button", { name: "Batalkan Prioritas 1", exact: true }),
    ).toBeEnabled();
    await group
      .getByRole("button", { name: "Lihat semua", exact: true })
      .last()
      .click();
    await expect(page.getByRole("dialog")).toContainText("Prioritas 5");
    await page.getByRole("button", { name: "Tutup", exact: true }).click();
    await track.focus();
    await track.press("ArrowRight");
    await expect(
      group.getByRole("heading", { name: "Kebiasaan hari ini" }),
    ).toBeInViewport();
    expect(
      await page
        .locator('[data-screen="/"]')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBeTruthy();
    await expect
      .poll(() =>
        track.evaluate(
          (el) => el.scrollLeft + el.clientWidth >= el.scrollWidth - 3,
        ),
      )
      .toBeTruthy();
    await page.screenshot({ path: `test-results/home-cards-${width}.png` });
    await page.locator('[data-screen="/"] .screen-scroll').evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({ path: `test-results/home-top-${width}.png` });
  });
}

test("undoing an AI action has its own status", async ({ page, mock }) => {
  mock.tables.ai_messages[0].actions = [
    { message: "Catatan tersimpan", action_id: "action-1", can_undo: true },
  ];
  await page.goto("/ai");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/ai-proxy", async (route) => {
    await gate;
    await route.fulfill({ json: { success: true } });
  });
  await page
    .getByRole("button", { name: "Batalkan aksi", exact: true })
    .click();
  try {
    await expect(
      page.getByRole("button", { name: "Membatalkan aksi…", exact: true }),
    ).toBeDisabled();
    await expect(page.locator(".chat-processing")).toHaveCount(0);
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", { name: "Aksi dibatalkan", exact: true }),
  ).toBeVisible();
});
