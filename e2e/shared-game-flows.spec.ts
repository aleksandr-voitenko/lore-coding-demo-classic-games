import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";

type RealtimeSharedFlowCase = {
  activeStatus: string;
  gameId: string;
  name: string;
  prefix: string;
  startButtonTestId: string;
};

const realtimeSharedFlowCases: RealtimeSharedFlowCase[] = [
  {
    activeStatus: "Running",
    gameId: "snake",
    name: "Snake",
    prefix: "snake",
    startButtonTestId: "snake-start-button",
  },
  {
    activeStatus: "Running",
    gameId: "breakout",
    name: "Breakout",
    prefix: "breakout",
    startButtonTestId: "breakout-start-button",
  },
  {
    activeStatus: "Running",
    gameId: "space-invaders",
    name: "Space Invaders",
    prefix: "space-invaders",
    startButtonTestId: "space-invaders-start-button",
  },
  {
    activeStatus: "Running",
    gameId: "pong",
    name: "Pong",
    prefix: "pong",
    startButtonTestId: "pong-start-button",
  },
  {
    activeStatus: "Running",
    gameId: "asteroids",
    name: "Asteroids",
    prefix: "asteroids",
    startButtonTestId: "asteroids-start-button",
  },
];

async function expectAbandonDialogHidden(page: Page) {
  await expect(page.getByTestId("game-abandon-dialog")).toBeHidden();
}

async function expectGameMenuVisible(page: Page) {
  await expect(page.getByTestId("game-menu")).toBeVisible();
}

async function startRealtimeGame(page: Page, flowCase: RealtimeSharedFlowCase) {
  await page.getByTestId(flowCase.startButtonTestId).click();
  await expect(page.getByTestId(`${flowCase.prefix}-status`)).toHaveText(
    flowCase.activeStatus,
  );
}

test("Tetris supports ready Escape, Help pause/resume, and abandon confirmation", async ({
  page,
}) => {
  await openLauncher(page);
  await openGame(page, "tetris");

  await expect(page.getByTestId("tetris-status")).toHaveText("Ready");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("game-menu")).toBeVisible();

  await openGame(page, "tetris");
  await page.getByTestId("tetris-start-button").click();
  await expect(page.getByTestId("tetris-status")).toHaveText("Running");

  await page.getByTestId("tetris-board-help").click();
  await expect(page.getByTestId("tetris-help-screen")).toBeVisible();
  await expect(page.getByTestId("tetris-status")).toHaveText("Paused");

  await page.getByTestId("tetris-help-screen-close").click();
  await expect(page.getByTestId("tetris-help-screen")).toBeHidden();
  await expect(page.getByTestId("tetris-status")).toHaveText("Running");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("game-abandon-dialog")).toBeVisible();
  await expect(page.getByTestId("tetris-status")).toHaveText("Paused");

  await page.getByTestId("game-abandon-cancel").click();
  await expect(page.getByTestId("game-abandon-dialog")).toBeHidden();
  await expect(page.getByTestId("tetris-status")).toHaveText("Running");

  await page.keyboard.press("Escape");
  await page.getByTestId("game-abandon-confirm").click();
  await expect(page.getByTestId("game-menu")).toBeVisible();
});

test("Minesweeper supports flagging and blocks keyboard mode changes while Help is open", async ({
  page,
}) => {
  await openLauncher(page);
  await openGame(page, "minesweeper");

  await expect(page.getByTestId("minesweeper-status")).toHaveText("Ready");
  await expect(page.getByTestId("minesweeper-mines-remaining")).toHaveText("10");
  await expect(page.getByTestId("minesweeper-start-screen")).toBeVisible();
  await expect(page.getByTestId("minesweeper-start-leaderboard")).toBeVisible();
  await expect(page.getByTestId("minesweeper-cell-0:0")).toBeDisabled();

  await page.getByTestId("minesweeper-start-button").click();
  await expect(page.getByTestId("minesweeper-start-screen")).toBeHidden();
  await expect(page.getByTestId("minesweeper-cell-0:0")).toBeEnabled();

  await page.getByTestId("minesweeper-cell-0:0").click({ button: "right" });
  await expect(page.getByTestId("minesweeper-cell-0:0")).toHaveAccessibleName(
    "Column 1, row 1. Flagged.",
  );
  await expect(page.getByTestId("minesweeper-mines-remaining")).toHaveText("9");

  await page.getByTestId("minesweeper-board-help").click();
  await expect(page.getByTestId("minesweeper-help-screen")).toBeVisible();

  await page.keyboard.press("m");
  await page.keyboard.press("Escape");

  await expect(page.getByTestId("minesweeper-help-screen")).toBeHidden();
  await expect(page.getByTestId("minesweeper-active-mode")).toHaveText("Reveal");
});

for (const flowCase of realtimeSharedFlowCases) {
  test(`${flowCase.name} supports shared realtime Back, Help, Pause, Restart, and Escape flows`, async ({
    page,
  }) => {
    const status = page.getByTestId(`${flowCase.prefix}-status`);
    const backButton = page.getByTestId(`${flowCase.prefix}-back-to-menu`);
    const helpButton = page.getByTestId(`${flowCase.prefix}-board-help`);
    const helpScreen = page.getByTestId(`${flowCase.prefix}-help-screen`);
    const pauseButton = page.getByTestId(`${flowCase.prefix}-board-pause`);
    const restartButton = page.getByTestId(`${flowCase.prefix}-board-restart`);

    await openLauncher(page);
    await openGame(page, flowCase.gameId);

    await expect(status).toHaveText("Ready");
    await expect(pauseButton).toBeDisabled();
    await expect(restartButton).toBeDisabled();

    await backButton.click();
    await expectGameMenuVisible(page);

    await openGame(page, flowCase.gameId);
    await startRealtimeGame(page, flowCase);

    await helpButton.click();
    await expect(helpScreen).toBeVisible();
    await expect(status).toHaveText("Paused");
    await expect(pauseButton).toBeDisabled();

    await page.keyboard.press("Escape");
    await expect(helpScreen).toBeHidden();
    await expect(status).toHaveText(flowCase.activeStatus);

    await pauseButton.click();
    await expect(status).toHaveText("Paused");
    await expect(pauseButton).toHaveAccessibleName("Resume");

    await pauseButton.click();
    await expect(status).toHaveText(flowCase.activeStatus);
    await expect(pauseButton).toHaveAccessibleName("Pause");

    await restartButton.click();
    await expect(status).toHaveText(flowCase.activeStatus);

    await backButton.click();
    await expect(page.getByTestId("game-abandon-dialog")).toBeVisible();
    await expect(status).toHaveText("Paused");

    await page.getByTestId("game-abandon-cancel").click();
    await expectAbandonDialogHidden(page);
    await expect(status).toHaveText(flowCase.activeStatus);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("game-abandon-dialog")).toBeVisible();
    await expect(status).toHaveText("Paused");

    await page.getByTestId("game-abandon-confirm").click();
    await expectGameMenuVisible(page);
  });
}

test("2048 supports shared turn-based Help, Restart, Back, and Escape flows without Pause", async ({
  page,
}) => {
  await openLauncher(page);
  await openGame(page, "twenty-forty-eight");

  const status = page.getByTestId("twenty-forty-eight-status");
  const helpScreen = page.getByTestId("twenty-forty-eight-help-screen");
  const pauseButton = page.getByTestId("twenty-forty-eight-board-pause");

  await expect(status).toHaveText("Ready");
  await expect(pauseButton).toHaveCount(0);

  await page.getByTestId("twenty-forty-eight-board-help").click();
  await expect(helpScreen).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(helpScreen).toBeHidden();
  await expect(status).toHaveText("Ready");

  await page.keyboard.press("Escape");
  await expectGameMenuVisible(page);

  await openGame(page, "twenty-forty-eight");
  await page.getByTestId("twenty-forty-eight-overlay-start-button").click();

  await expect(status).toHaveText("Running");
  await expect(pauseButton).toHaveCount(0);

  await page.getByTestId("twenty-forty-eight-board-help").click();
  await expect(helpScreen).toBeVisible();
  await expect(status).toHaveText("Running");

  await page.keyboard.press("Escape");
  await expect(helpScreen).toBeHidden();
  await expect(status).toHaveText("Running");

  await page.getByTestId("twenty-forty-eight-board-restart").click();
  await expect(status).toHaveText("Ready");

  await page.getByTestId("twenty-forty-eight-overlay-start-button").click();
  await expect(status).toHaveText("Running");

  await page.getByTestId("twenty-forty-eight-back-to-menu").click();
  await expect(page.getByTestId("game-abandon-dialog")).toBeVisible();
  await expect(status).toHaveText("Running");

  await page.getByTestId("game-abandon-cancel").click();
  await expectAbandonDialogHidden(page);
  await expect(status).toHaveText("Running");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("game-abandon-dialog")).toBeVisible();
  await expect(status).toHaveText("Running");

  await page.getByTestId("game-abandon-confirm").click();
  await expectGameMenuVisible(page);
});
