import type { APIRequestContext, Locator, Page, TestInfo } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";

const mobileViewport = {
  height: 844,
  width: 390,
};

test.use({ viewport: mobileViewport });

function createMobilePlayerName(testInfo: TestInfo) {
  const runPart = Date.now().toString(36).slice(-5).toUpperCase();

  return `M${testInfo.workerIndex}${testInfo.retry}${runPart}`;
}

async function seedLeaderboardRecord(
  request: APIRequestContext,
  {
    leaderboardKey,
    name,
    score,
  }: {
    leaderboardKey: string;
    name: string;
    score: number;
  },
) {
  const response = await request.post("/api/leaderboard", {
    data: {
      leaderboardKey,
      name,
      score,
      sortDirection: "desc",
    },
  });

  expect(response.status()).toBe(201);
}

async function expectHorizontallyFitsViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();

  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

test("mobile viewport keeps launcher card, actions, Help, and leaderboard usable", async ({
  page,
  request,
}, testInfo) => {
  const playerName = createMobilePlayerName(testInfo);

  await seedLeaderboardRecord(request, {
    leaderboardKey: "snake|mode=levels",
    name: playerName,
    score: 42,
  });

  await openLauncher(page);

  const snakeCard = page.getByTestId("game-card-snake");

  await expect(page.viewportSize()).toEqual(mobileViewport);
  await expect(snakeCard).toHaveAccessibleName("Play Snake");
  await expectHorizontallyFitsViewport(page, snakeCard);

  await openGame(page, "snake");

  await expect(page.getByTestId("snake-status")).toHaveText("Ready");

  const boardActions = page.getByTestId("snake-board-actions");

  await boardActions.scrollIntoViewIfNeeded();
  await expectHorizontallyFitsViewport(page, boardActions);
  await expect(page.getByTestId("snake-back-to-menu")).toBeVisible();
  await expect(page.getByTestId("snake-board-help")).toBeVisible();
  await expect(page.getByTestId("snake-board-pause")).toBeVisible();
  await expect(page.getByTestId("snake-board-restart")).toBeVisible();

  const leaderboard = page.getByTestId("snake-start-leaderboard");

  await leaderboard.scrollIntoViewIfNeeded();
  await expect(leaderboard).toContainText(playerName);
  await expectHorizontallyFitsViewport(page, leaderboard);

  await page.getByTestId("snake-board-help").click();

  const helpScreen = page.getByTestId("snake-help-screen");

  await expect(helpScreen).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Snake help" })).toBeVisible();
  await expectHorizontallyFitsViewport(page, page.getByTestId("snake-help-screen-close"));

  await page.getByTestId("snake-help-screen-close").click();

  await expect(helpScreen).toBeHidden();
  await expect(page.getByTestId("snake-status")).toHaveText("Ready");
});
