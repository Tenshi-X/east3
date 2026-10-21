import { test, expect } from "./fixtures";
import { shiftTimes } from "../../shared/life";

test("Seva schedule is previewed, corrected, and only saved after review", async ({
  page,
  mock,
}) => {
  await page.goto("/shifts");
  await page
    .getByRole("button", { name: "Pratinjau lampiran Seva · Okt 2026" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Periksa jadwal Seva" }),
  ).toBeVisible();
  expect(mock.writes.filter((w) => w.table === "life")).toHaveLength(0);
  await page.getByLabel("Shift 2026-10-23", { exact: true }).selectOption("1");
  await page
    .getByRole("button", { name: "Simpan jadwal yang diperiksa" })
    .click();
  await expect(
    page.getByRole("button", { name: "Jadwal tersimpan" }),
  ).toBeVisible();
  const write = mock.writes.find((w) => w.body?.op === "save_shift_import");
  expect(write?.body.params.rows).toHaveLength(31);
  expect(
    write?.body.params.rows.find((r: any) => r.date === "2026-10-23").code,
  ).toBe("1");
  expect(
    mock.tables.shift_assignments.find((s) => s.date === "2026-10-31")
      ?.end_time,
  ).toBe("2026-10-31T23:00:00.000Z");
});

test("health records retain failed drafts, save estimates, and can be undone", async ({
  page,
  mock,
}) => {
  await page.goto("/health");
  await page
    .getByLabel("Apa yang dimakan?", { exact: true })
    .fill("Nasi ayam dan tempe");
  mock.fail.add("/api/ai-proxy");
  await page.getByRole("button", { name: "Catat", exact: true }).click();
  await expect(
    page.getByLabel("Apa yang dimakan?", { exact: true }),
  ).toHaveValue("Nasi ayam dan tempe");
  await expect(page.getByRole("alert")).toBeVisible();
  mock.fail.delete("/api/ai-proxy");
  await page.getByRole("button", { name: "Catat", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Batalkan aksi", exact: true }),
  ).toBeVisible();
  expect(mock.tables.wellness_logs[0]).toMatchObject({
    kind: "meal",
    description: "Nasi ayam dan tempe",
    date: "2026-10-17",
  });
  await page
    .getByRole("button", { name: "Batalkan aksi", exact: true })
    .click();
  await expect.poll(() => mock.tables.wellness_logs.length).toBe(0);
});

test("calendar shows a night shift that began the previous day", async ({
  page,
  mock,
}) => {
  mock.tables.shift_assignments.push({
    id: "night",
    date: "2026-10-16",
    code: "3",
    ...shiftTimes("2026-10-16", "3", "Asia/Jakarta"),
  });
  await page.goto("/calendar");
  await expect(
    page.getByText("Shift 3 · Malam", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Impor & kelola shift" }).click();
  await expect(
    page.getByRole("heading", { name: "Jadwal shift", exact: true }),
  ).toBeVisible();
});

test("health profile persists optional targets and plan completion is actionable", async ({
  page,
  mock,
}) => {
  await page.goto("/health");
  await page.getByLabel("Tinggi (cm)", { exact: true }).fill("165");
  await page.getByLabel("Berat awal (kg)", { exact: true }).fill("47");
  await page
    .getByRole("button", { name: "Simpan profil", exact: true })
    .click();
  await expect(
    page.getByText("Profil tersimpan.", { exact: true }),
  ).toBeVisible();
  expect(mock.tables.health_profiles[0]).toMatchObject({
    height_cm: 165,
    weight_kg: 47,
  });
  expect(mock.tables.health_profiles[0].calorie_target).toBeUndefined();
  await page.goto("/plan");
  await expect(page.getByText("Full body A", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Sudah latihan", exact: true })
    .click();
  await expect
    .poll(() =>
      mock.writes.some(
        (w) =>
          w.body?.op === "plan_state" &&
          w.body.params.key === "workout" &&
          w.body.params.status === "done",
      ),
    )
    .toBe(true);
});

test("chat restores actionable cards and undo survives a reload", async ({
  page,
  mock,
}) => {
  mock.tables.ai_messages.push({
    id: "health-action",
    role: "assistant",
    content: "Berat dicatat.",
    actions: [
      {
        message: "Berat badan dicatat.",
        action_id: "owned-action",
        can_undo: true,
      },
    ],
  });
  await page.goto("/ai");
  await expect(
    page.getByRole("button", { name: "Batalkan aksi", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Batalkan aksi", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Aksi dibatalkan", exact: true }),
  ).toBeVisible();
  expect(
    mock.writes.find((w) => w.body?.op === "undo_life_action")?.body.params
      .action_id,
  ).toBe("owned-action");
});
