import { _android, expect } from "@playwright/test";
import fs from "node:fs";
const device = (await _android.devices()).find((device) =>
  device.serial().startsWith("emulator-"),
);
if (!device)
  throw new Error("Buka emulator dan pasang APK debug terlebih dahulu.");
const view = await device.webView({ pkg: "com.atlas.app" });
const page = await view.page();
const previousSession = await page.evaluate(() => ({
  token: localStorage.getItem("east3_token"),
  user: localStorage.getItem("east3_user"),
}));
const writes = [];
fs.mkdirSync("test-results", { recursive: true });
try {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET")
      writes.push({ url: url.pathname, body: request.postDataJSON() });
    const data =
      url.pathname === "/api/auth/me"
        ? {
            user: {
              id: "native-test",
              display_name: "Pengujian",
              email: "native@example.test",
            },
          }
        : url.pathname === "/api/ai-proxy"
          ? { reply: "Balasan pengujian lokal." }
          : request.method() === "POST"
            ? { data: { id: "native-conv" } }
            : { data: [], has_more: false };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.evaluate(() => {
    localStorage.setItem("east3_token", "native-test-token");
    localStorage.setItem(
      "east3_user",
      JSON.stringify({
        id: "native-test",
        display_name: "Pengujian",
        email: "native@example.test",
      }),
    );
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hari ini", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "AI", exact: true }).click();
  const composer = page.getByLabel("Pesan untuk Atlas");
  await composer.click();
  await expect
    .poll(() => page.locator(".app-frame").getAttribute("class"))
    .toContain("keyboard-open");
  await composer.fill("Pesan pengujian");
  await expect(
    page.getByRole("button", { name: "Kirim pesan" }),
  ).toBeInViewport();
  await device.screenshot({ path: "test-results/native-keyboard.png" });
  await device.shell("input keyevent 4");
  await expect
    .poll(() => page.locator(".app-frame").getAttribute("class"))
    .not.toContain("keyboard-open");
  await expect(
    page.getByRole("heading", { name: "Atlas AI", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kirim pesan" }).click();
  await expect(page.getByRole("log")).toContainText("Balasan pengujian lokal.");
  await device.shell("input keyevent 4");
  await expect(
    page.getByRole("heading", { name: "Hari ini", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tambah", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await device.shell("input keyevent 4");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await device.screenshot({ path: "test-results/native-home.png" });
  fs.writeFileSync(
    "test-results/native-smoke.json",
    JSON.stringify(
      {
        model: device.model(),
        checks: [
          "keyboard resizes composer",
          "back hides keyboard",
          "chat uses mocked API",
          "back returns home",
          "back dismisses sheet",
        ],
        writes,
      },
      null,
      2,
    ),
  );
  console.log("Native smoke: seluruh pemeriksaan lulus pada", device.model());
} finally {
  // Test login is only on this emulator; remove it before disconnecting.
  await page.evaluate((previous) => {
    for (const [key, value] of [
      ["east3_token", previous.token],
      ["east3_user", previous.user],
    ]) {
      if (value && previous.token !== "native-test-token")
        localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    }
  }, previousSession);
  await page.reload();
  await device.close();
}
