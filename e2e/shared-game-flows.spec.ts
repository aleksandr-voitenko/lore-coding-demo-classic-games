import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";

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
