import { expect, test } from "./support/fixtures";
import { openGame, openLauncher, selectGameParameter } from "./support/app";

const gameCardIds = [
  "snake",
  "tetris",
  "breakout",
  "minesweeper",
  "space-invaders",
  "twenty-forty-eight",
  "pong",
  "simon",
] as const;

test("launcher renders game cards and configurable parameters", async ({ page }) => {
  await openLauncher(page);

  for (const gameId of gameCardIds) {
    await expect(page.getByTestId(`game-card-${gameId}`)).toBeVisible();
  }

  await expect(page.getByText("8 games available")).toBeVisible();
  await expect(page.getByTestId("snake-board-size")).toHaveValue("19");
  await expect(page.getByTestId("tetris-board-size")).toHaveValue("10x20");
  await expect(page.getByTestId("tetris-start-level")).toHaveValue("1");
  await expect(page.getByTestId("minesweeper-mines")).toHaveValue("10");
});

test("launcher-selected Tetris parameters seed the opened game", async ({ page }) => {
  await openLauncher(page);
  await selectGameParameter(page, "tetris-board-size", "12x22");
  await selectGameParameter(page, "tetris-start-level", "3");

  await openGame(page, "tetris");

  await expect(page.getByTestId("tetris-status")).toHaveText("Ready");
  await expect(page.getByTestId("tetris-level")).toHaveText("3");
  await expect(page.getByTestId("tetris-board")).toHaveAttribute(
    "aria-label",
    /Tetris board\. Field 12 by 22\. Score 0\. Lines 0\. Level 3\. Ready\./,
  );
});
