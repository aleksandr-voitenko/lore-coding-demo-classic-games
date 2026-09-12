import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";
import {
  SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS,
  SPACE_INVADERS_TICK_DELAY_MS,
} from "../src/lib/space-invaders-game-engine";

test("Space Invaders distinguishes revenge warnings from shields through pause and firing", async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date("2026-09-13T12:00:00Z") });
  await page.route("**/api/replays/space-invaders/run", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ id: "revenge-warning-preview", seed: 122 }),
      status: 201,
    }),
  );
  await openLauncher(page);
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await openGame(page, "space-invaders");
  await page.clock.pauseAt(new Date("2026-09-13T12:01:00Z"));
  await page.getByTestId("space-invaders-start-button").click();
  await expect(page.getByTestId("space-invaders-status")).toHaveText("Running");

  // This seeded firing sequence destroys a Revenge Alien on tick 148 and
  // selects both a shielded alien and a Shield Bearer for the warning.
  for (let tick = 0; tick < 148; tick += 8) {
    await page.keyboard.press("Space");
    await page.clock.runFor(Math.min(8, 148 - tick) * SPACE_INVADERS_TICK_DELAY_MS);
  }

  const warnings = page.getByTestId("space-invaders-revenge-warning");
  const alerts = warnings.locator(".space-invaders-revenge-alert");
  const ember = warnings.first().locator(".space-invaders-revenge-ember").first();
  const shieldedTarget = page.locator(
    '[data-invader-revenge-warning="true"][data-invader-shielded="true"]',
  );
  await expect(warnings).toHaveCount(5);
  await expect(alerts).toHaveCount(5);
  await expect(shieldedTarget).toHaveCount(1);
  await expect(shieldedTarget.getByTestId("space-invaders-invader-shield")).toBeVisible();
  await expect(shieldedTarget.locator(".space-invaders-revenge-alert")).toBeVisible();
  await expect(page.getByTestId("space-invaders-revenge-aura")).toHaveCount(0);
  await expect(ember).toHaveCSS("animation-name", "space-invaders-revenge-ember-rise");
  await expect(ember).toHaveCSS("animation-play-state", "running");

  const bearer = page.locator(
    '[data-invader-kind="shield-bearer"][data-invader-revenge-warning="true"]',
  );
  const alertBounds = await bearer.locator(".space-invaders-revenge-alert").boundingBox();
  const blipBounds = await bearer.getByTestId("space-invaders-shield-bearer-blip").boundingBox();
  expect(alertBounds!.y + alertBounds!.height).toBeLessThan(blipBounds!.y);

  const desktopPath = testInfo.outputPath("revenge-warning-desktop.png");
  await page.getByTestId("space-invaders-board-frame").screenshot({ path: desktopPath });
  await testInfo.attach("Revenge warning on desktop", { path: desktopPath, contentType: "image/png" });

  await page.keyboard.press("p");
  await expect(page.getByTestId("space-invaders-status")).toHaveText("Paused");
  await expect(ember).toHaveCSS("animation-play-state", "paused");
  const pausedTransform = await ember.evaluate((element) => getComputedStyle(element).transform);
  await page.clock.runFor(3_000);
  await expect(warnings).toHaveCount(5);
  await expect(ember).toHaveCSS("transform", pausedTransform);

  await page.keyboard.press("p");
  await expect(page.getByTestId("space-invaders-status")).toHaveText("Running");
  await expect(ember).toHaveCSS("animation-play-state", "running");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(ember).toHaveCSS("animation-name", "none");
  await expect(alerts.first()).toHaveCSS("animation-name", "none");
  await expect(alerts.first()).toBeVisible();
  await expect(ember).toHaveCSS("opacity", "0.8");

  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePath = testInfo.outputPath("revenge-warning-mobile.png");
  await page.getByTestId("space-invaders-board-frame").screenshot({ path: mobilePath });
  await testInfo.attach("Revenge warning with reduced motion", { path: mobilePath, contentType: "image/png" });
  const boardBounds = await page.getByTestId("space-invaders-board").boundingBox();
  for (const alert of await alerts.all()) {
    const bounds = await alert.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(boardBounds!.x);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(boardBounds!.x + boardBounds!.width);
    expect(bounds!.y).toBeGreaterThanOrEqual(boardBounds!.y);
  }

  await page.clock.runFor((SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS - 1) * SPACE_INVADERS_TICK_DELAY_MS);
  await expect(warnings).toHaveCount(5);
  await page.clock.runFor(SPACE_INVADERS_TICK_DELAY_MS);
  await expect(warnings).toHaveCount(0);
  await expect(page.locator(".space-invaders-revenge-ember")).toHaveCount(0);
  await expect(page.getByTestId("space-invaders-invader-shield").first()).toBeVisible();
});
