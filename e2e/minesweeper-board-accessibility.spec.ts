import { expect, test } from "./support/fixtures";
import { openGame, openLauncher, selectGameParameter } from "./support/app";

test("Hard Minesweeper uses one roving tab stop for grid navigation and actions", async ({
  page,
}) => {
  await page.route("**/api/replays/minesweeper/run", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ id: "run-minesweeper-roving-focus-e2e", seed: 1 }),
      contentType: "application/json",
      status: 201,
    });
  });

  await openLauncher(page);
  await selectGameParameter(page, "minesweeper-difficulty", "hard");
  await openGame(page, "minesweeper");
  await page.getByTestId("minesweeper-start-button").click();

  const board = page.getByTestId("minesweeper-board");
  const cells = board.getByRole("button");
  const firstCell = page.getByTestId("minesweeper-cell-0:0");

  await expect(board).toHaveAttribute("role", "grid");
  await expect(board).toHaveAttribute("aria-colcount", "30");
  await expect(board).toHaveAttribute("aria-rowcount", "16");
  await expect(cells).toHaveCount(480);
  await expect(board.locator('button[tabindex="0"]')).toHaveCount(1);
  await expect(board.locator('button[tabindex="-1"]')).toHaveCount(479);

  await firstCell.focus();
  await expect(firstCell).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("minesweeper-cell-1:0")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("minesweeper-cell-1:1")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByTestId("minesweeper-cell-0:1")).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByTestId("minesweeper-cell-29:1")).toBeFocused();
  await page.keyboard.press("Control+Home");
  await expect(firstCell).toBeFocused();
  await page.keyboard.press("Control+End");
  await expect(page.getByTestId("minesweeper-cell-29:15")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("minesweeper-cell-29:15")).toBeFocused();

  await firstCell.focus();
  await page.keyboard.press("Enter");
  await expect(firstCell).not.toHaveAccessibleName("Column 1, row 1. Covered.");
  await expect(firstCell).toBeFocused();
  await expect(firstCell).toHaveAttribute("tabindex", "0");

  const coveredCellId = await board
    .getByRole("button", { name: /Covered\.$/ })
    .first()
    .getAttribute("data-cell-id");

  expect(coveredCellId).not.toBeNull();
  const coveredCell = page.getByTestId(`minesweeper-cell-${coveredCellId}`);

  await coveredCell.focus();
  await page.keyboard.press("f");
  await expect(coveredCell).toHaveAccessibleName(/Flagged\.$/);
  await expect(coveredCell).toBeFocused();

  await page.keyboard.press("f");
  await expect(coveredCell).toHaveAccessibleName(/Covered\.$/);
  await page.keyboard.press("m");
  await expect(page.getByTestId("minesweeper-active-mode")).toHaveText("Flag");
  await page.keyboard.press("Space");
  await expect(coveredCell).toHaveAccessibleName(/Flagged\.$/);
  await expect(coveredCell).toBeFocused();

  await page.getByTestId("minesweeper-board-restart").click();
  await expect(board.locator('button[tabindex="0"]')).toHaveCount(0);
  await page.getByTestId("minesweeper-start-button").click();
  await expect(page.locator(`[data-cell-id="${coveredCellId}"]`)).toHaveAttribute(
    "tabindex",
    "0",
  );
});
