import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";

const desktopViewport = {
  height: 900,
  width: 1440,
};
const compactDesktopViewport = {
  height: 720,
  width: 1280,
};

const centeredBoardTolerancePx = 48;
const alignedEdgeTolerancePx = 1;
const stackedGapPx = 16;
const viewportFitTolerancePx = 1;

const layoutCases = [
  {
    boardTestId: "snake-board",
    gameId: "snake",
    name: "Snake",
    statsMode: "top-bar",
    statusTestId: "snake-status",
  },
  {
    boardTestId: "tetris-board",
    gameId: "tetris",
    name: "Tetris",
    statsMode: "top-bar",
    statusTestId: "tetris-status",
  },
  {
    boardTestId: "breakout-board",
    gameId: "breakout",
    name: "Breakout",
    statsMode: "top-bar",
    statusTestId: "breakout-status",
  },
  {
    boardTestId: "minesweeper-board",
    gameId: "minesweeper",
    name: "Minesweeper",
    statsMode: "top-bar",
    statusTestId: "minesweeper-status",
  },
  {
    boardTestId: "space-invaders-board",
    gameId: "space-invaders",
    name: "Space Invaders",
    statsMode: "board-hud",
    statusTestId: "space-invaders-status",
  },
  {
    boardTestId: "pong-board",
    gameId: "pong",
    name: "Pong",
    statsMode: "top-bar",
    statusTestId: "pong-status",
  },
  {
    boardTestId: "twenty-forty-eight-board",
    gameId: "twenty-forty-eight",
    name: "2048",
    statsMode: "top-bar",
    statusTestId: "twenty-forty-eight-status",
  },
  {
    boardTestId: "simon-board",
    gameId: "simon",
    name: "Simon",
    statsMode: "top-bar",
    statusTestId: "simon-status",
  },
  {
    boardTestId: "asteroids-board",
    gameId: "asteroids",
    name: "Asteroids",
    statsMode: "top-bar",
    statusTestId: "asteroids-status",
  },
] as const;

test.use({ viewport: desktopViewport });

async function expectCenteredBoardAndViewportFit(page: Page, boardTestId: string) {
  const board = page.getByTestId(boardTestId);
  const stage = page.getByTestId("game-board-stage");
  const pageScroll = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    scrollY: window.scrollY,
  }));

  await expect(board).toBeVisible();
  await expect(stage).toBeVisible();

  const [boardBox, stageBox] = await Promise.all([
    board.boundingBox(),
    stage.boundingBox(),
  ]);
  const viewport = page.viewportSize();

  expect(boardBox).not.toBeNull();
  expect(stageBox).not.toBeNull();
  expect(viewport).not.toBeNull();

  expect(pageScroll.scrollY).toBeLessThanOrEqual(viewportFitTolerancePx);
  expect(pageScroll.scrollHeight).toBeLessThanOrEqual(
    pageScroll.clientHeight + viewportFitTolerancePx,
  );
  expect(stageBox!.y + stageBox!.height).toBeLessThanOrEqual(
    viewport!.height + viewportFitTolerancePx,
  );

  const boardCenterX = boardBox!.x + boardBox!.width / 2;
  const viewportCenterX = viewport!.width / 2;

  expect(Math.abs(boardCenterX - viewportCenterX)).toBeLessThanOrEqual(
    centeredBoardTolerancePx,
  );

  return { boardBox: boardBox!, stageBox: stageBox!, viewport: viewport! };
}

async function expectCenteredBoardAndTopStatsBar(page: Page, boardTestId: string) {
  const { stageBox } = await expectCenteredBoardAndViewportFit(page, boardTestId);
  const sidebar = page.getByTestId("game-sidebar");
  const statItems = sidebar.locator("dl > div");

  await expect(sidebar).toBeVisible();

  const sidebarBox = await sidebar.boundingBox();

  expect(sidebarBox).not.toBeNull();
  expect(sidebarBox!.y).toBeGreaterThanOrEqual(-viewportFitTolerancePx);
  expect(sidebarBox!.y + sidebarBox!.height).toBeLessThanOrEqual(stageBox!.y);
  expect(stageBox!.y - (sidebarBox!.y + sidebarBox!.height)).toBeLessThanOrEqual(
    stackedGapPx,
  );
  expect(Math.abs(sidebarBox!.x - stageBox!.x)).toBeLessThanOrEqual(
    alignedEdgeTolerancePx,
  );
  expect(Math.abs(sidebarBox!.width - stageBox!.width)).toBeLessThanOrEqual(
    alignedEdgeTolerancePx,
  );

  const statItemCount = await statItems.count();
  expect(statItemCount).toBeGreaterThan(1);
  const statItemBoxes = await Promise.all(
    Array.from({ length: statItemCount }, (_, index) => statItems.nth(index).boundingBox()),
  );
  expect(statItemBoxes.every((box) => box !== null)).toBe(true);
  const statItemTop = statItemBoxes[0]!.y;
  for (const statItemBox of statItemBoxes) {
    expect(Math.abs(statItemBox!.y - statItemTop)).toBeLessThanOrEqual(
      alignedEdgeTolerancePx,
    );
  }
}

async function expectCenteredBoardAndBoardHud(page: Page, boardTestId: string) {
  await page.getByTestId("space-invaders-start-button").click();
  await expect(page.getByTestId("space-invaders-status")).toHaveText("Running");

  const { boardBox, viewport } = await expectCenteredBoardAndViewportFit(page, boardTestId);
  const boardFrame = page.getByTestId("space-invaders-board-frame");
  const healthHud = page.getByTestId("space-invaders-health-hud");
  const scoreHud = page.getByTestId("space-invaders-score-hud");

  await expect(page.getByTestId("game-sidebar")).toHaveCount(0);
  await expect(boardFrame).toBeVisible();
  await expect(healthHud).toBeVisible();
  await expect(scoreHud).toBeVisible();
  await expect(page.getByTestId("space-invaders-lives")).toHaveText("3");
  await expect(page.getByTestId("space-invaders-score")).toHaveText("0");

  const [boardFrameBox, healthBox, scoreBox] = await Promise.all([
    boardFrame.boundingBox(),
    healthHud.boundingBox(),
    scoreHud.boundingBox(),
  ]);

  expect(boardFrameBox).not.toBeNull();
  expect(healthBox).not.toBeNull();
  expect(scoreBox).not.toBeNull();
  expect(boardFrameBox!.y).toBeLessThanOrEqual(viewportFitTolerancePx);
  expect(boardFrameBox!.y + boardFrameBox!.height).toBeGreaterThanOrEqual(
    viewport.height - viewportFitTolerancePx,
  );
  expect(scoreBox!.x).toBeGreaterThanOrEqual(boardBox.x - alignedEdgeTolerancePx);
  expect(scoreBox!.y).toBeGreaterThanOrEqual(boardBox.y - alignedEdgeTolerancePx);
  expect(healthBox!.x + healthBox!.width).toBeLessThanOrEqual(
    boardBox.x + boardBox.width + alignedEdgeTolerancePx,
  );
  expect(healthBox!.y).toBeGreaterThanOrEqual(boardBox.y - alignedEdgeTolerancePx);
}

async function expectGameLayout(page: Page, layoutCase: (typeof layoutCases)[number]) {
  if (layoutCase.statsMode === "board-hud") {
    await expectCenteredBoardAndBoardHud(page, layoutCase.boardTestId);
    return;
  }

  await expectCenteredBoardAndTopStatsBar(page, layoutCase.boardTestId);
}

function getLayoutDescription(layoutCase: (typeof layoutCases)[number]) {
  if (layoutCase.statsMode === "board-hud") {
    return "centers the board with in-board HUD stats";
  }

  return "centers the board below a one-line stats bar";
}

for (const layoutCase of layoutCases) {
  test(`${layoutCase.name} ${getLayoutDescription(layoutCase)}`, async ({ page }) => {
    await openLauncher(page);
    await openGame(page, layoutCase.gameId);

    await expect(page.getByTestId(layoutCase.statusTestId)).toHaveText("Ready");
    await expectGameLayout(page, layoutCase);
  });
}

test.describe("compact desktop viewport", () => {
  test.use({ viewport: compactDesktopViewport });

  for (const layoutCase of layoutCases) {
    test(`${layoutCase.name} fits board and stats without page scrolling`, async ({
      page,
    }) => {
      await openLauncher(page);
      await openGame(page, layoutCase.gameId);

      await expect(page.getByTestId(layoutCase.statusTestId)).toHaveText("Ready");
      await expectGameLayout(page, layoutCase);
    });
  }
});
