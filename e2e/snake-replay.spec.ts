import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { openGame, openLauncher, signUpFromLauncher } from "./support/app";
import {
  advanceSnakeGame,
  createInitialGame,
  queueGameDirection,
  type Direction,
  type GameState,
} from "../src/lib/snake-game-engine";

type SavedSnakeReplaySummary = {
  events: Array<{
    direction?: string;
    tick: number;
    type: string;
  }>;
  finalStatus: string;
};

type SnakeReplayRunResponse = {
  id: string;
  seed: number;
};

type SnakeReplayTestEvent =
  | {
      elapsedMs: number;
      seq: number;
      tick: number;
      type: "advance" | "start";
    }
  | {
      direction: Direction;
      elapsedMs: number;
      seq: number;
      tick: number;
      type: "direction";
    };

const SNAKE_REPLAY_SCHEMA_VERSION = 1;
const REPLAY_DIRECTIONS: Direction[] = ["up", "right", "down", "left"];

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

function createReplayInitialGame(seed: number) {
  const random = createReplayRandom(seed);
  const game: GameState = {
    ...createInitialGame({
      random,
    }),
    status: "running",
  };

  return {
    game,
    random,
  };
}

function getReplaySearchKey(game: GameState) {
  return [
    game.direction,
    game.queuedDirection,
    game.snake.map(({ x, y }) => `${x},${y}`).join(";"),
  ].join("|");
}

function findDirectionsToInitialPickup(seed: number) {
  const { game, random } = createReplayInitialGame(seed);
  const queue: Array<{ directions: Direction[]; game: GameState }> = [
    {
      directions: [],
      game,
    },
  ];
  const visited = new Set([getReplaySearchKey(game)]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.directions.length >= 40) {
      continue;
    }

    for (const direction of REPLAY_DIRECTIONS) {
      const queuedGame = queueGameDirection(current.game, direction);
      const nextGame = advanceSnakeGame(queuedGame, { random });
      const nextDirections = [...current.directions, direction];

      if (nextGame.score > current.game.score) {
        return nextDirections;
      }

      if (nextGame.status !== "running") {
        continue;
      }

      const key = getReplaySearchKey(nextGame);

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

  throw new Error(`Could not find a deterministic Snake replay pickup path for seed ${seed}.`);
}

function appendReplayDirectionEvent({
  direction,
  events,
  tick,
}: {
  direction: Direction;
  events: SnakeReplayTestEvent[];
  tick: number;
}) {
  events.push({
    direction,
    elapsedMs: tick * 1_000 + events.length,
    seq: events.length,
    tick,
    type: "direction",
  });
}

function appendReplayAdvanceEvent(events: SnakeReplayTestEvent[], tick: number) {
  events.push({
    elapsedMs: tick * 1_000 + events.length,
    seq: events.length,
    tick,
    type: "advance",
  });
}

function createReplayPayloadWithInitialPickup(
  run: SnakeReplayRunResponse,
  { stopAfterPickup = false }: { stopAfterPickup?: boolean } = {},
) {
  const pickupDirections = findDirectionsToInitialPickup(run.seed);
  const { game: initialGame, random } = createReplayInitialGame(run.seed);
  const events: SnakeReplayTestEvent[] = [
    {
      elapsedMs: 0,
      seq: 0,
      tick: 0,
      type: "start",
    },
  ];
  let game = initialGame;
  let tick = 0;

  for (const direction of pickupDirections) {
    if (game.queuedDirection !== direction) {
      appendReplayDirectionEvent({
        direction,
        events,
        tick,
      });
    }

    const queuedGame = queueGameDirection(game, direction);

    appendReplayAdvanceEvent(events, tick);
    game = advanceSnakeGame(queuedGame, { random });
    tick += 1;
  }

  if (!stopAfterPickup) {
    while (game.status === "running" && tick < 80) {
      appendReplayAdvanceEvent(events, tick);
      game = advanceSnakeGame(game, { random });
      tick += 1;
    }

    if (game.status !== "lost" && game.status !== "won") {
      throw new Error(`Snake replay pickup fixture did not reach a terminal state.`);
    }
  }

  return {
    events,
    finalLevel: game.level,
    finalScore: game.score,
    finalStatus: game.status === "won" ? "won" : "lost",
    finalTick: tick,
    gameId: "snake",
    leaderboardKey: "snake|mode=levels",
    runId: run.id,
    schemaVersion: SNAKE_REPLAY_SCHEMA_VERSION,
    seed: run.seed,
    startedAt: "2026-06-08T12:00:00.000Z",
  };
}

async function seedSnakeLeaderboard(request: APIRequestContext, namePrefix: string) {
  for (let index = 0; index < 3; index += 1) {
    const response = await request.post("/api/leaderboard", {
      data: {
        leaderboardKey: "snake|mode=levels",
        name: `${namePrefix} Seed ${index}`,
        score: 100 - index,
        sortDirection: "desc",
      },
    });

    expect(response.status()).toBe(201);
  }
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

test("Snake replay preserves a first turn pressed while the server run starts", async ({
  page,
}, testInfo) => {
  const displayName = `Replay ${testInfo.workerIndex}${testInfo.retry}${Date.now() % 100_000}`;

  await openLauncher(page);
  await signUpFromLauncher(page, displayName);
  await openGame(page, "snake");

  await page.getByTestId("snake-start-button").click();
  await page.keyboard.press("ArrowUp");

  await expect(page.getByTestId("snake-status")).toHaveText("Running");
  await expect(page.getByTestId("snake-game-over-screen")).toBeVisible();

  const liveFinalHead = await getSnakeHeadPosition(page);

  await page.getByTestId("snake-save-replay-button").click();
  await expect(page.getByTestId("snake-save-replay-button")).toHaveText("Replay saved");

  const savedReplay = await page.evaluate(async () => {
    const response = await fetch("/api/replays/snake");
    const data = (await response.json()) as { replay: SavedSnakeReplaySummary };

    return {
      events: data.replay.events.slice(0, 3),
      finalStatus: data.replay.finalStatus,
    };
  });

  expect(savedReplay).toMatchObject({
    events: [
      {
        tick: 0,
        type: "start",
      },
      {
        direction: "up",
        tick: 0,
        type: "direction",
      },
      {
        tick: 0,
        type: "advance",
      },
    ],
    finalStatus: "lost",
  });

  await page.goto("/profile");
  await page.getByTestId("profile-snake-last-replay").click();

  await expect(page).toHaveURL("/?replay=snake");
  await expect(page.getByTestId("snake-replay-status")).toHaveText("Replay playing");
  await expect(page.getByTestId("snake-replay-back-to-menu")).toBeVisible();
  await page.getByTestId("snake-replay-back-to-menu").click();
  await expect(page).toHaveURL("/profile");

  await page.getByTestId("profile-snake-last-replay").click();
  await expect(page).toHaveURL("/?replay=snake");
  await expect(page.getByTestId("snake-replay-status")).toHaveText("Replay playing");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL("/profile");

  await page.getByTestId("profile-snake-last-replay").click();
  await expect(page).toHaveURL("/?replay=snake");
  await expect(page.getByTestId("snake-replay-status")).toHaveText("Replay playing");

  const replayStartedAt = Date.now();

  await expect(page.getByTestId("snake-replay-finished-screen")).toBeVisible();
  expect(Date.now() - replayStartedAt).toBeGreaterThanOrEqual(700);
  await expect(page.getByTestId("snake-replay-final-score")).toHaveText("0");
  await expect(await getSnakeHeadPosition(page)).toEqual(liveFinalHead);

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL("/profile");
});

test("Snake replay displays pickup feedback during playback", async ({ page }, testInfo) => {
  const displayName = `Replay Feedback ${testInfo.workerIndex}${testInfo.retry}${Date.now() % 100_000}`;

  await openLauncher(page);
  await signUpFromLauncher(page, displayName);

  let replayPayload: ReturnType<typeof createReplayPayloadWithInitialPickup> | null = null;

  for (let attempt = 0; attempt < 20 && replayPayload === null; attempt += 1) {
    const replayRun = await page.evaluate(async () => {
      const runResponse = await fetch("/api/replays/snake/run", {
        method: "POST",
      });
      const run = (await runResponse.json()) as SnakeReplayRunResponse;

      return run;
    });

    if (findDirectionsToInitialPickup(replayRun.seed).length <= 8) {
      replayPayload = createReplayPayloadWithInitialPickup(replayRun, {
        stopAfterPickup: true,
      });
    }
  }

  expect(replayPayload).not.toBeNull();

  const saveResponse = await page.evaluate(async (payload) => {
    const response = await fetch("/api/replays/snake", {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    return {
      body: await response.text(),
      status: response.status,
    };
  }, replayPayload);

  expect(saveResponse).toMatchObject({
    status: 201,
  });

  await page.goto("/?replay=snake");
  await expect(page).toHaveURL("/?replay=snake");
  await expect(page.getByTestId("snake-replay-status")).toHaveText("Replay playing");
  await expect(page.getByTestId("snake-food-feedback")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId("snake-food-feedback")).toContainText("+1");
});

test("Snake replay save uses the latest run after an unsaved restart", async ({
  page,
  request,
}, testInfo) => {
  const displayName = `Replay Restart ${testInfo.workerIndex}${testInfo.retry}${Date.now() % 100_000}`;

  await seedSnakeLeaderboard(request, displayName);
  await openLauncher(page);
  await signUpFromLauncher(page, displayName);
  await openGame(page, "snake");

  await page.getByTestId("snake-start-button").click();
  await expect(page.getByTestId("snake-status")).toHaveText("Running");
  await page.waitForTimeout(650);
  await page.keyboard.press("ArrowUp");

  await expect(page.getByTestId("snake-game-over-screen")).toBeVisible();
  await expect(page.getByTestId("snake-new-game-button")).toBeVisible();
  await page.getByTestId("snake-new-game-button").click();

  await expect(page.getByTestId("snake-status")).toHaveText("Running");
  await page.waitForTimeout(650);
  await page.keyboard.press("ArrowDown");

  await expect(page.getByTestId("snake-game-over-screen")).toBeVisible();

  const liveFinalHead = await getSnakeHeadPosition(page);

  await page.getByTestId("snake-save-replay-button").click();
  await expect(page.getByTestId("snake-save-replay-button")).toHaveText("Replay saved");

  const savedReplay = await page.evaluate(async () => {
    const response = await fetch("/api/replays/snake");
    const data = (await response.json()) as { replay: SavedSnakeReplaySummary };

    return {
      directionEvents: data.replay.events.filter((event) => event.type === "direction"),
      finalStatus: data.replay.finalStatus,
    };
  });

  expect(savedReplay.directionEvents.map((event) => event.direction)).toEqual(["down"]);
  expect(savedReplay.finalStatus).toBe("lost");

  await page.goto("/profile");
  await page.getByTestId("profile-snake-last-replay").click();

  await expect(page).toHaveURL("/?replay=snake");
  await expect(page.getByTestId("snake-replay-status")).toHaveText("Replay playing");
  await expect(page.getByTestId("snake-replay-finished-screen")).toBeVisible();
  await expect(await getSnakeHeadPosition(page)).toEqual(liveFinalHead);
});

test("Snake replay preserves a delayed downward turn without phantom advances", async ({
  page,
}, testInfo) => {
  const displayName = `Replay Down ${testInfo.workerIndex}${testInfo.retry}${Date.now() % 100_000}`;

  await openLauncher(page);
  await signUpFromLauncher(page, displayName);
  await openGame(page, "snake");

  await page.getByTestId("snake-start-button").click();
  await expect(page.getByTestId("snake-status")).toHaveText("Running");
  await page.waitForTimeout(650);
  await page.keyboard.press("ArrowDown");

  await expect(page.getByTestId("snake-game-over-screen")).toBeVisible();

  const liveFinalHead = await getSnakeHeadPosition(page);

  await page.getByTestId("snake-save-replay-button").click();
  await expect(page.getByTestId("snake-save-replay-button")).toHaveText("Replay saved");

  const savedReplay = await page.evaluate(async () => {
    const response = await fetch("/api/replays/snake");
    const data = (await response.json()) as { replay: SavedSnakeReplaySummary };

    return {
      directionEvents: data.replay.events.filter((event) => event.type === "direction"),
      finalStatus: data.replay.finalStatus,
    };
  });

  expect(savedReplay).toMatchObject({
    directionEvents: [
      {
        direction: "down",
        type: "direction",
      },
    ],
    finalStatus: "lost",
  });

  await page.goto("/profile");
  await page.getByTestId("profile-snake-last-replay").click();

  await expect(page).toHaveURL("/?replay=snake");
  await expect(page.getByTestId("snake-replay-status")).toHaveText("Replay playing");
  await expect(page.getByTestId("snake-replay-finished-screen")).toBeVisible();
  await expect(page.getByTestId("snake-replay-final-score")).toHaveText("0");
  await expect(await getSnakeHeadPosition(page)).toEqual(liveFinalHead);
});
