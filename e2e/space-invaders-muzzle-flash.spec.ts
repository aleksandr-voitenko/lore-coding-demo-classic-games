import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";
import { SPACE_INVADERS_TICK_DELAY_MS } from "../src/lib/space-invaders-game-engine";

test("Space Invaders marks the firing weapon with a brief flash that follows the game clock", async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date("2026-09-13T12:00:00Z") });
  await page.route("**/api/replays/space-invaders/run", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ id: "muzzle-flash-preview", seed: 122 }),
      status: 201,
    }),
  );
  await openLauncher(page);
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await openGame(page, "space-invaders");
  await page.clock.pauseAt(new Date("2026-09-13T12:01:00Z"));
  await page.getByTestId("space-invaders-start-button").click();
  await expect(page.getByTestId("space-invaders-status")).toHaveText("Running");

  const flashes = page.getByTestId("space-invaders-muzzle-flash");
  const shots = page.getByTestId("space-invaders-invader-shot");
  // With this seed and no player shots, alien 4:5 first fires on tick 81.
  await page.clock.runFor(80 * SPACE_INVADERS_TICK_DELAY_MS);
  await expect(shots).toHaveCount(0);
  await expect(flashes).toHaveCount(0);
  await page.clock.runFor(SPACE_INVADERS_TICK_DELAY_MS);
  await expect(shots).toHaveCount(1);
  await expect(shots).toHaveAttribute("data-shot-source", "4:5");
  await expect(flashes).toHaveCount(1);
  await expect(flashes).toHaveAttribute("data-muzzle-flash-source", "4:5");
  await expect(flashes).toHaveCSS("animation-duration", "0.18s");
  await expect(flashes).toHaveCSS("opacity", "1");

  const alienBounds = await flashes.locator("..").boundingBox();
  const flashBounds = await flashes.boundingBox();
  expect(Math.abs(
    flashBounds!.x + flashBounds!.width / 2 - alienBounds!.x - alienBounds!.width / 2,
  )).toBeLessThan(1);
  expect(flashBounds!.y).toBeGreaterThan(alienBounds!.y + alienBounds!.height * 0.65);
  expect(flashBounds!.y + flashBounds!.height).toBeLessThan(alienBounds!.y + alienBounds!.height * 1.4);
  expect(flashBounds!.width / alienBounds!.width).toBeCloseTo(0.54, 2);
  expect(flashBounds!.height / alienBounds!.height).toBeCloseTo(0.6, 2);

  const desktopPath = testInfo.outputPath("muzzle-flash-desktop.png");
  await page.getByTestId("space-invaders-board-frame").screenshot({ path: desktopPath });
  await testInfo.attach("Muzzle flash at shot release", { path: desktopPath, contentType: "image/png" });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePath = testInfo.outputPath("muzzle-flash-mobile.png");
  await page.getByTestId("space-invaders-board-frame").screenshot({ path: mobilePath });
  await testInfo.attach("Muzzle flash on a phone", { path: mobilePath, contentType: "image/png" });

  await page.keyboard.press("p");
  await expect(page.getByTestId("space-invaders-status")).toHaveText("Paused");
  await page.clock.runFor(3_000);
  await expect(flashes).toHaveCount(1);
  await expect(flashes).toHaveCSS("opacity", "1");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(flashes).toHaveCSS("animation-name", "none");
  await expect(flashes).toHaveCSS("opacity", "0.8");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.keyboard.press("p");
  await expect(page.getByTestId("space-invaders-status")).toHaveText("Running");
  await page.clock.runFor(3 * SPACE_INVADERS_TICK_DELAY_MS);
  const opacity = await flashes.evaluate(element => Number(getComputedStyle(element).opacity));
  expect(opacity).toBeGreaterThan(0);
  expect(opacity).toBeLessThan(0.6);
  await page.clock.runFor(2 * SPACE_INVADERS_TICK_DELAY_MS);
  await expect(flashes).toHaveCount(1);
  await page.clock.runFor(SPACE_INVADERS_TICK_DELAY_MS);
  await expect(flashes).toHaveCount(0);
  await expect(shots).toHaveCount(1);
});
