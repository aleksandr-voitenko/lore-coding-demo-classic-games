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
  { boardTestId: "snake-board", gameId: "snake", name: "Snake", statusTestId: "snake-status" },
  {
    boardTestId: "tetris-board",
    gameId: "tetris",
    name: "Tetris",
    statusTestId: "tetris-status",
  },
  {
    boardTestId: "breakout-board",
    gameId: "breakout",
    name: "Breakout",
    statusTestId: "breakout-status",
  },
  {
    boardTestId: "minesweeper-board",
    gameId: "minesweeper",
    name: "Minesweeper",
    statusTestId: "minesweeper-status",
  },
  {
    boardTestId: "space-invaders-board",
    gameId: "space-invaders",
    name: "Space Invaders",
    statusTestId: "space-invaders-status",
  },
  {
    boardTestId: "pong-board",
    gameId: "pong",
    name: "Pong",
    statusTestId: "pong-status",
  },
  {
    boardTestId: "twenty-forty-eight-board",
    gameId: "twenty-forty-eight",
    name: "2048",
    statusTestId: "twenty-forty-eight-status",
  },
  { boardTestId: "simon-board", gameId: "simon", name: "Simon", statusTestId: "simon-status" },
  {
    boardTestId: "asteroids-board",
    gameId: "asteroids",
    name: "Asteroids",
    statusTestId: "asteroids-status",
  },
] as const;

test.use({ viewport: desktopViewport });

async function expectCenteredBoardAndTopStatsBar(page: Page, boardTestId: string) {
  const board = page.getByTestId(boardTestId);
  const sidebar = page.getByTestId("game-sidebar");
  const stage = page.getByTestId("game-board-stage");
  const statItems = sidebar.locator("dl > div");
  const pageScroll = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    scrollY: window.scrollY,
  }));

  await expect(board).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(stage).toBeVisible();

  const [boardBox, sidebarBox, stageBox] = await Promise.all([
    board.boundingBox(),
    sidebar.boundingBox(),
    stage.boundingBox(),
  ]);
  const viewport = page.viewportSize();

  expect(boardBox).not.toBeNull();
  expect(sidebarBox).not.toBeNull();
  expect(stageBox).not.toBeNull();
  expect(viewport).not.toBeNull();

  expect(pageScroll.scrollY).toBeLessThanOrEqual(viewportFitTolerancePx);
  expect(pageScroll.scrollHeight).toBeLessThanOrEqual(
    pageScroll.clientHeight + viewportFitTolerancePx,
  );
  expect(sidebarBox!.y).toBeGreaterThanOrEqual(-viewportFitTolerancePx);
  expect(stageBox!.y + stageBox!.height).toBeLessThanOrEqual(
    viewport!.height + viewportFitTolerancePx,
  );

  const boardCenterX = boardBox!.x + boardBox!.width / 2;
  const viewportCenterX = viewport!.width / 2;

  expect(Math.abs(boardCenterX - viewportCenterX)).toBeLessThanOrEqual(
    centeredBoardTolerancePx,
  );
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

for (const layoutCase of layoutCases) {
  test(`${layoutCase.name} centers the board below a one-line stats bar`, async ({ page }) => {
    await openLauncher(page);
    await openGame(page, layoutCase.gameId);

    await expect(page.getByTestId(layoutCase.statusTestId)).toHaveText("Ready");
    await expectCenteredBoardAndTopStatsBar(page, layoutCase.boardTestId);
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
      await expectCenteredBoardAndTopStatsBar(page, layoutCase.boardTestId);
    });
  }
});
