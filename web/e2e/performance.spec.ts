import { test, expect } from "./fixtures";

test("home shares plan reads and loads its cards in one request", async ({
  page,
  mock,
}) => {
  const reads: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) reads.push(url.pathname);
  });
  await page.goto("/");
  await expect(
    page.getByRole("status", { name: "Memuat", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Selesaikan Prioritas 1", exact: true }),
  ).toBeEnabled();
  expect(reads.filter((p) => p === "/api/data/dashboard")).toHaveLength(1);
  expect(reads.filter((p) => p === "/api/ai-proxy")).toHaveLength(1);
  expect(reads.filter((p) => p.startsWith("/api/data/"))).toEqual([
    "/api/data/dashboard",
  ]);
});

test("editing home does not refresh a hidden calendar; returning refreshes it", async ({
  page,
  mock,
}) => {
  let eventReads = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/data/events") eventReads++;
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Selesaikan Prioritas 1", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Kalender", exact: true }).click();
  await expect(
    page
      .locator('[data-screen="/calendar"]')
      .getByText("Rapat tim", { exact: true }),
  ).toBeVisible();
  const before = eventReads;
  await page.getByRole("link", { name: "Beranda", exact: true }).click();
  await page
    .getByRole("button", { name: "Selesaikan Prioritas 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Batalkan Prioritas 1", exact: true }),
  ).toBeEnabled();
  expect(eventReads).toBe(before);
  mock.tables.events[0].title = "Agenda terbaru";
  await page.getByRole("link", { name: "Kalender", exact: true }).click();
  await expect(
    page
      .locator('[data-screen="/calendar"]')
      .getByText("Agenda terbaru", { exact: true }),
  ).toBeVisible();
  expect(eventReads).toBe(before + 1);
});

test("task completion is immediate and rolls back if saving fails", async ({
  page,
  mock,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Selesaikan Prioritas 1", exact: true }),
  ).toBeEnabled();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/data/priorities/task-0", async (route) => {
    await gate;
    await route.fulfill({ status: 503, json: { error: "Penyimpanan gagal" } });
  });
  await page
    .getByRole("button", { name: "Selesaikan Prioritas 1", exact: true })
    .click();
  try {
    await expect(
      page.getByRole("button", { name: "Batalkan Prioritas 1", exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", { name: "Selesaikan Prioritas 1", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("status").filter({ hasText: "Penyimpanan gagal" }),
  ).toBeVisible();
});
