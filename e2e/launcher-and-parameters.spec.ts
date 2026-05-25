import type { Page } from "@playwright/test";

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

type GameId = (typeof gameCardIds)[number];

type LauncherParameterHandoffCase = {
  assertGameSeeded: (page: Page) => Promise<void>;
  gameId: GameId;
  name: string;
  parameters: {
    testId: string;
    value: string;
  }[];
};

const launcherParameterHandoffCases: LauncherParameterHandoffCase[] = [
  {
    assertGameSeeded: async (page) => {
      await expect(page.getByTestId("snake-status")).toHaveText("Ready");
      await expect(page.getByTestId("snake-board")).toHaveAttribute(
        "aria-label",
        /Snake board\. Field 25 by 25\. Score 0\. Ready\./,
      );
    },
    gameId: "snake",
    name: "Snake board size",
    parameters: [{ testId: "snake-board-size", value: "25" }],
  },
  {
    assertGameSeeded: async (page) => {
      await expect(page.getByTestId("breakout-status")).toHaveText("Ready");
      await expect(page.getByTestId("breakout-lives")).toHaveText("5");
      await expect(page.getByTestId("breakout-board")).toHaveAttribute(
        "aria-label",
        /Breakout board\. Field 480 by 640\. Score 0\. Lives 5\. 50 bricks remaining\. Ready\./,
      );
    },
    gameId: "breakout",
    name: "Breakout board and lives",
    parameters: [
      { testId: "breakout-board-size", value: "480x640" },
      { testId: "breakout-lives", value: "5" },
    ],
  },
  {
    assertGameSeeded: async (page) => {
      await expect(page.getByTestId("minesweeper-status")).toHaveText("Ready");
      await expect(page.getByTestId("minesweeper-mines-remaining")).toHaveText("40");
      await expect(page.getByTestId("minesweeper-board")).toHaveAttribute(
        "aria-label",
        /Minesweeper board\. Field 16 by 16\. 40 mines\. 0 flags\. 0 safe cells revealed\. Ready\./,
      );
    },
    gameId: "minesweeper",
    name: "Minesweeper board and mines",
    parameters: [
      { testId: "minesweeper-board-size", value: "16x16" },
      { testId: "minesweeper-mines", value: "40" },
    ],
  },
  {
    assertGameSeeded: async (page) => {
      await expect(page.getByTestId("space-invaders-status")).toHaveText("Ready");
      await expect(page.getByTestId("space-invaders-remaining")).toHaveText("24");
      await expect(page.getByTestId("space-invaders-invader")).toHaveCount(24);
      await expect(page.getByTestId("space-invaders-board")).toHaveAttribute(
        "aria-label",
        /Space Invaders board\. Field 540 by 720\. Score 0\. Lives 3\. 24 invaders remaining\. Ready\./,
      );
    },
    gameId: "space-invaders",
    name: "Space Invaders board and alien count",
    parameters: [
      { testId: "space-invaders-board-size", value: "540x720" },
      { testId: "space-invaders-aliens", value: "24" },
    ],
  },
  {
    assertGameSeeded: async (page) => {
      await expect(page.getByTestId("twenty-forty-eight-status")).toHaveText("Ready");
      await expect(page.getByTestId("twenty-forty-eight-board")).toHaveAttribute(
        "aria-label",
        /2048 board\. Field 6 by 6\. Score 0\. Best 0\. Top tile [24]\. Goal 4096\. Ready\./,
      );
      await expect(page.getByTestId("twenty-forty-eight-board")).toHaveAttribute(
        "aria-colcount",
        "6",
      );
      await expect(page.getByTestId("twenty-forty-eight-board")).toHaveAttribute(
        "aria-rowcount",
        "6",
      );
    },
    gameId: "twenty-forty-eight",
    name: "2048 board and goal",
    parameters: [
      { testId: "twenty-forty-eight-board-size", value: "6" },
      { testId: "twenty-forty-eight-goal", value: "4096" },
    ],
  },
  {
    assertGameSeeded: async (page) => {
      await expect(page.getByTestId("pong-status")).toHaveText("Ready");
      await expect(page.getByTestId("pong-remaining-score")).toHaveText("1400");
      await expect(page.getByTestId("pong-board")).toHaveAttribute(
        "aria-label",
        /Pong board\. Field 480 by 640\. Score 1400\. Player 0\. Computer 0\. First to 7\. Ready\./,
      );
    },
    gameId: "pong",
    name: "Pong board and target",
    parameters: [
      { testId: "pong-board-size", value: "480x640" },
      { testId: "pong-target", value: "7" },
    ],
  },
  {
    assertGameSeeded: async (page) => {
      await expect(page.getByTestId("simon-status")).toHaveText("Ready");
      await expect(page.getByTestId("simon-target")).toHaveText("16");
      await expect(page.getByTestId("simon-board")).toHaveAttribute(
        "aria-label",
        /Simon board\. Round 0\. Score 0\. Target 16\. Ready\./,
      );
    },
    gameId: "simon",
    name: "Simon target",
    parameters: [{ testId: "simon-target", value: "16" }],
  },
];

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

for (const handoffCase of launcherParameterHandoffCases) {
  test(`launcher-selected ${handoffCase.name} parameters seed the opened game`, async ({
    page,
  }) => {
    await openLauncher(page);

    for (const parameter of handoffCase.parameters) {
      await selectGameParameter(page, parameter.testId, parameter.value);
    }

    await openGame(page, handoffCase.gameId);

    await handoffCase.assertGameSeeded(page);
  });
}
