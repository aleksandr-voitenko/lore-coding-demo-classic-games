import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";

const desktopViewport = {
  height: 900,
  width: 1440,
};

const centeredBoardTolerancePx = 48;
const alignedTopTolerancePx = 1;
const adjacentSidebarGapPx = 24;

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
] as const;

test.use({ viewport: desktopViewport });

async function expectCenteredBoardAndAlignedSidebar(page: Page, boardTestId: string) {
  const board = page.getByTestId(boardTestId);
  const sidebar = page.getByTestId("game-sidebar");
  const stage = page.getByTestId("game-board-stage");

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

  const boardCenterX = boardBox!.x + boardBox!.width / 2;
  const viewportCenterX = viewport!.width / 2;

  expect(Math.abs(boardCenterX - viewportCenterX)).toBeLessThanOrEqual(
    centeredBoardTolerancePx,
  );
  expect(Math.abs(sidebarBox!.y - stageBox!.y)).toBeLessThanOrEqual(
    alignedTopTolerancePx,
  );
  expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(stageBox!.x);
  expect(stageBox!.x - (sidebarBox!.x + sidebarBox!.width)).toBeLessThanOrEqual(
    adjacentSidebarGapPx,
  );
}

for (const layoutCase of layoutCases) {
  test(`${layoutCase.name} centers the board beside a top-aligned info panel`, async ({
    page,
  }) => {
    await openLauncher(page);
    await openGame(page, layoutCase.gameId);

    await expect(page.getByTestId(layoutCase.statusTestId)).toHaveText("Ready");
    await expectCenteredBoardAndAlignedSidebar(page, layoutCase.boardTestId);
  });
}
