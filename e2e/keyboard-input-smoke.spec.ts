import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";

test("2048 keyboard input starts play and advances moves", async ({ page }) => {
  await openLauncher(page);
  await openGame(page, "twenty-forty-eight");

  await expect(page.getByTestId("twenty-forty-eight-status")).toHaveText("Ready");
  await expect(page.getByTestId("twenty-forty-eight-moves")).toHaveText("0");
  await expect(page.getByTestId("twenty-forty-eight-start-screen")).toBeVisible();

  await page.keyboard.press("Enter");

  await expect(page.getByTestId("twenty-forty-eight-status")).toHaveText("Running");
  await expect(page.getByTestId("twenty-forty-eight-start-screen")).toBeHidden();

  for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
    await page.keyboard.press(key);
  }

  await expect(page.getByTestId("twenty-forty-eight-moves")).not.toHaveText("0");
  await expect(page.getByTestId("twenty-forty-eight-board")).toHaveAttribute(
    "aria-label",
    /2048 board\. Field 4 by 4\..*Running\./,
  );
});

test("Minesweeper keyboard input toggles active mode", async ({ page }) => {
  await openLauncher(page);
  await openGame(page, "minesweeper");

  await expect(page.getByTestId("minesweeper-status")).toHaveText("Ready");
  await expect(page.getByTestId("minesweeper-active-mode")).toHaveText("Reveal");

  await page.keyboard.press("m");

  await expect(page.getByTestId("minesweeper-active-mode")).toHaveText("Flag");

  await page.keyboard.press("M");

  await expect(page.getByTestId("minesweeper-active-mode")).toHaveText("Reveal");
});

test("Tetris keyboard input starts, soft-drops, pauses, and resumes", async ({
  page,
}) => {
  await openLauncher(page);
  await openGame(page, "tetris");

  await expect(page.getByTestId("tetris-status")).toHaveText("Ready");
  await expect(page.getByTestId("tetris-score")).toHaveText("0");
  await expect(page.getByTestId("tetris-start-screen")).toBeVisible();

  await page.keyboard.press("Enter");

  await expect(page.getByTestId("tetris-status")).toHaveText("Running");
  await expect(page.getByTestId("tetris-start-screen")).toBeHidden();

  await page.keyboard.press("ArrowDown");

  await expect(page.getByTestId("tetris-score")).not.toHaveText("0");
  await expect(page.getByTestId("tetris-board")).toHaveAttribute(
    "aria-label",
    /Tetris board\. Field 10 by 20\. Score [1-9]\d*\. Lines 0\. Level 1\. Running\./,
  );

  await page.keyboard.press("p");
  await expect(page.getByTestId("tetris-status")).toHaveText("Paused");

  await page.keyboard.press("P");
  await expect(page.getByTestId("tetris-status")).toHaveText("Running");
});
