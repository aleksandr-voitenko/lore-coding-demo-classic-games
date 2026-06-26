import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";

type KeyboardPauseCase = {
  activeStatus: string;
  gameId: string;
  name: string;
  prefix: string;
  serveKey?: string;
  serveReadyText?: string;
  serveButtonTestId?: string;
  serveScreenTestId?: string;
  startButtonTestId: string;
};

const keyboardPauseCases: KeyboardPauseCase[] = [
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
    serveButtonTestId: "breakout-serve-button",
    serveScreenTestId: "breakout-first-serve-screen",
    startButtonTestId: "breakout-start-button",
  },
  {
    activeStatus: "Running",
    gameId: "tetris",
    name: "Tetris",
    prefix: "tetris",
    startButtonTestId: "tetris-start-button",
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
    serveKey: "Enter",
    serveReadyText: "Press Space or Enter to serve",
    serveScreenTestId: "pong-serve-ready-message",
    startButtonTestId: "pong-start-button",
  },
  {
    activeStatus: "Watch",
    gameId: "simon",
    name: "Simon",
    prefix: "simon",
    startButtonTestId: "simon-start-button",
  },
  {
    activeStatus: "Running",
    gameId: "asteroids",
    name: "Asteroids",
    prefix: "asteroids",
    startButtonTestId: "asteroids-start-button",
  },
];

async function getTetrisMinimumOccupiedColumn(page: Page) {
  return page.getByTestId("tetris-board").locator("> span").evaluateAll((cells) => {
    const board = cells[0]?.parentElement;
    const columnCount =
      board === null || board === undefined
        ? 10
        : getComputedStyle(board).gridTemplateColumns.split(" ").length;
    const occupiedColumns = cells.flatMap((cell, index) =>
      cell.className.includes("--tetris-piece-border") ? [index % columnCount] : [],
    );

    return Math.min(...occupiedColumns);
  });
}

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
  await expect(page.getByTestId("minesweeper-start-screen")).toBeVisible();

  await page.keyboard.press("m");

  await expect(page.getByTestId("minesweeper-active-mode")).toHaveText("Reveal");

  await page.keyboard.press("Enter");

  await expect(page.getByTestId("minesweeper-start-screen")).toBeHidden();

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

test("Tetris held horizontal input keeps moving the falling piece", async ({ page }) => {
  await openLauncher(page);
  await openGame(page, "tetris");

  await expect(page.getByTestId("tetris-status")).toHaveText("Ready");
  await expect(page.getByTestId("tetris-start-screen")).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.getByTestId("tetris-status")).toHaveText("Running");

  await expect.poll(() => getTetrisMinimumOccupiedColumn(page)).toBeGreaterThan(0);

  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(360);
  await page.keyboard.up("ArrowLeft");

  await expect.poll(() => getTetrisMinimumOccupiedColumn(page)).toBe(0);
});

test("Asteroids keyboard input starts, thrusts, rotates, fires, pauses, and resumes", async ({
  page,
}) => {
  await openLauncher(page);
  await openGame(page, "asteroids");

  await expect(page.getByTestId("asteroids-status")).toHaveText("Ready");
  await expect(page.getByTestId("asteroids-start-screen")).toBeVisible();

  await page.keyboard.press("Enter");

  await expect(page.getByTestId("asteroids-status")).toHaveText("Running");
  await expect(page.getByTestId("asteroids-start-screen")).toBeHidden();
  await expect(page.getByTestId("asteroids-ship")).toBeVisible();

  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(80);
  await page.keyboard.up("ArrowUp");
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("Space");

  await expect(page.getByTestId("asteroids-bullet")).toBeVisible();
  await expect(page.getByTestId("asteroids-board")).toHaveAttribute(
    "aria-label",
    /Asteroids board\. Field 800 by 600\..*Running\./,
  );

  await page.keyboard.press("p");
  await expect(page.getByTestId("asteroids-status")).toHaveText("Paused");

  await page.keyboard.press("P");
  await expect(page.getByTestId("asteroids-status")).toHaveText("Running");
});

test("Pong ready serve only starts from Space or Enter", async ({ page }) => {
  await openLauncher(page);
  await openGame(page, "pong");

  const status = page.getByTestId("pong-status");

  await expect(status).toHaveText("Ready");
  await expect(page.getByTestId("pong-start-button")).toBeVisible();

  await page.keyboard.press("Space");
  await expect(status).toHaveText("Ready");

  await page.getByTestId("pong-start-button").click();
  await expect(page.getByTestId("pong-start-screen")).toBeHidden();
  await expect(page.getByTestId("pong-serve-ready-message")).toBeVisible();
  await expect(page.getByTestId("pong-serve-key-hint")).toHaveText(
    "Press Space or Enter to serve",
  );

  await page.keyboard.press("p");
  await expect(status).toHaveText("Ready");

  await page.keyboard.press("Space");
  await expect(status).toHaveText("Running");
});

for (const keyboardPauseCase of keyboardPauseCases) {
  test(`${keyboardPauseCase.name} direct keyboard pause only uses P`, async ({ page }) => {
    await openLauncher(page);
    await openGame(page, keyboardPauseCase.gameId);

    const status = page.getByTestId(`${keyboardPauseCase.prefix}-status`);

    await expect(status).toHaveText("Ready");
    await page.getByTestId(keyboardPauseCase.startButtonTestId).click();

    if (keyboardPauseCase.serveButtonTestId) {
      await expect(status).toHaveText("Ready");

      if (keyboardPauseCase.serveScreenTestId) {
        await expect(page.getByTestId(keyboardPauseCase.serveScreenTestId)).toBeVisible();
      }

      await page.getByTestId(keyboardPauseCase.serveButtonTestId).click();
    } else if (keyboardPauseCase.serveKey !== undefined) {
      await expect(status).toHaveText("Ready");
      if (keyboardPauseCase.serveScreenTestId) {
        const serveScreen = page.getByTestId(keyboardPauseCase.serveScreenTestId);

        await expect(serveScreen).toBeVisible();

        if (keyboardPauseCase.serveReadyText !== undefined) {
          await expect(serveScreen).toContainText(keyboardPauseCase.serveReadyText);
        }
      }
      await page.locator("body").click({ position: { x: 1, y: 1 } });
      await page.keyboard.press(keyboardPauseCase.serveKey);
    }

    await expect(status).toHaveText(keyboardPauseCase.activeStatus);

    await page.locator("body").click({ position: { x: 1, y: 1 } });
    await page.keyboard.press("Space");
    await expect(status).not.toHaveText("Paused");

    await page.keyboard.press("p");
    await expect(status).toHaveText("Paused");

    await page.keyboard.press("P");
    await expect(status).not.toHaveText("Paused");
  });
}
