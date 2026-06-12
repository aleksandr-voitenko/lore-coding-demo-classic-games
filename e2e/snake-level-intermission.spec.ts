import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";
import {
  advanceSnakeGame,
  createInitialGame,
  getGameTickDelay,
  getPointKey,
  isSamePoint,
  queueGameDirection,
  type Direction,
  type GameState,
  type Point,
} from "../src/lib/snake-game-engine";
import { SNAKE_LEVEL_INTERMISSION_MS } from "../src/lib/snake-level-intermission";

type SnakeStep = {
  delayMs: number;
  direction: Direction;
};

const INTERMISSION_TEST_SEED = 12_345;
const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];
const directionKeys: Record<Direction, string> = {
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
};

function createReplayRandom(seed: number) {
  let value = seed % 2_147_483_647;

  if (value <= 0) {
    value += 2_147_483_646;
  }

  return () => {
    value = (value * 16_807) % 2_147_483_647;

    return (value - 1) / 2_147_483_646;
  };
}

function createRunningSeededSnakeGame(seed: number) {
  const random = createReplayRandom(seed);
  const game: GameState = {
    ...createInitialGame({ random }),
    status: "running",
  };

  return {
    game,
    random,
  };
}

function getSearchKey(game: GameState) {
  return [
    game.direction,
    game.queuedDirection,
    game.snake.map(getPointKey).join(";"),
  ].join("|");
}

function findPathToTarget(game: GameState, target: Point) {
  const queue: Array<{ directions: Direction[]; game: GameState }> = [
    {
      directions: [],
      game,
    },
  ];
  const visited = new Set([getSearchKey(game)]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.directions.length >= game.boardSize * game.boardSize) {
      continue;
    }

    for (const direction of DIRECTIONS) {
      const queuedGame = queueGameDirection(current.game, direction);
      const nextGame = advanceSnakeGame(queuedGame, { random: () => 0 });

      if (nextGame.status !== "running") {
        continue;
      }

      const nextDirections = [...current.directions, direction];

      if (isSamePoint(nextGame.snake[0], target)) {
        return nextDirections;
      }

      const key = getSearchKey(nextGame);

      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push({
        directions: nextDirections,
        game: nextGame,
      });
    }
  }

  throw new Error(`Could not find a Snake path to ${getPointKey(target)}.`);
}

function getSnakeStepsToNextLevel(seed: number) {
  const { game: initialGame, random } = createRunningSeededSnakeGame(seed);
  const targetLevel = initialGame.level + 1;
  const steps: SnakeStep[] = [];
  let game = initialGame;

  while (game.level < targetLevel && steps.length < 240) {
    const target = game.door.isOpen ? game.door.position : game.key ?? game.food;

    if (target === null) {
      throw new Error("Snake level fixture could not find a target item.");
    }

    const path = findPathToTarget(game, target);

    for (const direction of path) {
      const delayMs = getGameTickDelay(game);

      if (delayMs === null) {
        throw new Error("Snake level fixture encountered a non-running game.");
      }

      steps.push({ delayMs, direction });
      game = advanceSnakeGame(queueGameDirection(game, direction), { random });

      if (game.level >= targetLevel) {
        return steps;
      }
    }
  }

  throw new Error("Snake level fixture did not reach the next level.");
}

async function getSnakeHeadPosition(page: Page) {
  return page.evaluate(() => {
    const board = document.querySelector('[data-testid="snake-board"]');
    const head = document.querySelector('[data-testid="snake-head"]');
    const cell = head?.parentElement;

    if (board === null || cell === undefined || cell === null) {
      return null;
    }

    const cells = Array.from(board.children);
    const index = cells.indexOf(cell);
    const boardSize = Math.sqrt(cells.length);

    return {
      x: index % boardSize,
      y: Math.floor(index / boardSize),
    };
  });
}

test("Snake shows a next-level intermission after entering the open door", async ({ page }) => {
  const steps = getSnakeStepsToNextLevel(INTERMISSION_TEST_SEED);

  await page.clock.install({ time: new Date("2026-06-12T12:00:00.000Z") });
  await page.route("**/api/replays/snake/run", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "snake-intermission-run",
        seed: INTERMISSION_TEST_SEED,
      }),
      status: 201,
    }),
  );

  await openLauncher(page);
  await openGame(page, "snake");
  await page.clock.pauseAt(new Date("2026-06-12T12:00:05.000Z"));
  await page.getByTestId("snake-start-button").click();
  await expect(page.getByTestId("snake-status")).toHaveText("Running");

  for (const { delayMs, direction } of steps) {
    await page.keyboard.press(directionKeys[direction]);
    await page.clock.runFor(delayMs);
  }

  await expect(page.getByTestId("snake-level-intermission")).toContainText("Level 2");
  await expect(page.getByTestId("snake-status")).toHaveText("Level 2");
  await expect(page.getByTestId("snake-level")).toHaveText("2");

  const intermissionHead = await getSnakeHeadPosition(page);

  await page.clock.runFor(SNAKE_LEVEL_INTERMISSION_MS - 25);
  await expect(page.getByTestId("snake-level-intermission")).toBeVisible();
  await expect(await getSnakeHeadPosition(page)).toEqual(intermissionHead);

  await page.clock.runFor(25);
  await expect(page.getByTestId("snake-level-intermission")).toHaveCount(0);
  await expect(page.getByTestId("snake-status")).toHaveText("Running");
});
