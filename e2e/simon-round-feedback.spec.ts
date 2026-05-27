import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";

const simonPadTestIds = [
  "simon-pad-green",
  "simon-pad-red",
  "simon-pad-yellow",
  "simon-pad-blue",
] as const;

async function getActiveSimonPadTestId(page: Page) {
  const activePadTestId = await page
    .locator('[data-testid^="simon-pad-"]')
    .evaluateAll((pads) => {
      const activePad = pads.find((pad) =>
        pad.className.includes("brightness-125"),
      );

      return activePad?.getAttribute("data-testid") ?? null;
    });

  expect(activePadTestId).not.toBeNull();

  return activePadTestId!;
}

test("Simon shows correct feedback before starting the next sequence", async ({ page }) => {
  await openLauncher(page);
  await openGame(page, "simon");

  const status = page.getByTestId("simon-status");
  const correctFeedback = page.getByTestId("simon-correct-feedback");

  await expect(status).toHaveText("Ready");
  await page.getByTestId("simon-start-button").click();

  await expect(status).toHaveText("Watch");
  const activePadTestId = await getActiveSimonPadTestId(page);

  await expect(status).toHaveText("Repeat");
  const activePad = page.getByTestId(activePadTestId);
  await activePad.click();

  await expect(status).toHaveText("Repeat");
  await expect(correctFeedback).toBeHidden();
  await expect(activePad).toBeDisabled();
  await expect(page.getByTestId("simon-score")).toHaveText("1");
  await expect(page.getByTestId("simon-round")).toHaveText("1");

  await expect(status).toHaveText("Correct", { timeout: 800 });
  await expect(correctFeedback).toBeVisible();

  await page.waitForTimeout(700);
  await expect(status).toHaveText("Correct");
  await expect(correctFeedback).toBeVisible();

  await expect(status).toHaveText("Watch", { timeout: 1_200 });
  await expect(correctFeedback).toBeHidden();
  await expect(page.getByTestId("simon-round")).toHaveText("2");
});

test("Simon shows miss feedback before the game-over leaderboard screen", async ({ page }) => {
  await openLauncher(page);
  await openGame(page, "simon");

  const status = page.getByTestId("simon-status");
  const missFeedback = page.getByTestId("simon-miss-feedback");
  const endScreen = page.getByTestId("simon-end-screen");

  await expect(status).toHaveText("Ready");
  await page.getByTestId("simon-start-button").click();

  await expect(status).toHaveText("Watch");
  const activePadTestId = await getActiveSimonPadTestId(page);
  const wrongPadTestId = simonPadTestIds.find((testId) => testId !== activePadTestId);

  expect(wrongPadTestId).toBeDefined();

  await expect(status).toHaveText("Repeat");
  await page.getByTestId(wrongPadTestId!).click();

  await expect(status).toHaveText("Repeat");
  await expect(missFeedback).toBeHidden();
  await expect(endScreen).toBeHidden();

  await expect(status).toHaveText("Miss", { timeout: 800 });
  await expect(missFeedback).toBeVisible();

  await page.waitForTimeout(700);
  await expect(status).toHaveText("Miss");
  await expect(missFeedback).toBeVisible();
  await expect(endScreen).toBeHidden();

  await expect(status).toHaveText("Game over", { timeout: 1_200 });
  await expect(missFeedback).toBeHidden();
  await expect(endScreen).toBeVisible();
});
