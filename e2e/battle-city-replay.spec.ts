import { expect, test } from "./support/fixtures";
import { openGame, openLauncher, signUpFromLauncher } from "./support/app";
import {
  applyBattleCityReplayAdvanceFrame,
  applyBattleCityReplayEvent,
  createBattleCityReplayLeaderboardKey,
  createInitialBattleCityReplayGame,
  parseBattleCityReplayPayload,
  BATTLE_CITY_REPLAY_SCHEMA_VERSION,
  type BattleCityReplayEvent,
  type BattleCityReplayPayload,
  type BattleCityReplayRun,
} from "../src/lib/battle-city-replay";

const LONG_RUNNING_REPLAY_TEST_TIMEOUT_MS = 60_000;
const REPLAY_TERMINAL_EXPECTATION_TIMEOUT_MS = 15_000;

test("Tank Patrol records seeded fixed-step input through a terminal loss", async ({
  page,
}) => {
  test.setTimeout(LONG_RUNNING_REPLAY_TEST_TIMEOUT_MS);

  let savedReplay: unknown = null;

  await page.clock.install({ time: new Date("2026-07-13T12:00:00.000Z") });
  await page.route("**/api/replays/battle-city/run", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ id: "run-1", seed: 4_321 }),
      contentType: "application/json",
      status: 201,
    });
  });
  await page.route("**/api/replays/battle-city", async (route) => {
    savedReplay = route.request().postDataJSON() as BattleCityReplayPayload;
    await route.fulfill({
      body: JSON.stringify({ saved: true }),
      contentType: "application/json",
      status: 201,
    });
  });

  await openLauncher(page);
  await openGame(page, "battle-city");
  await page.getByTestId("battle-city-start-button").click();
  await expect(page.getByTestId("battle-city-status")).toHaveText("Stage intro");
  await page.getByTestId("battle-city-board-help").click();
  await expect(page.getByTestId("battle-city-help-screen")).toBeVisible();
  await page.clock.runFor(5_000);
  await page.getByTestId("battle-city-help-screen-close").click();
  await expect(page.getByTestId("battle-city-help-screen")).toBeHidden();
  await page.clock.runFor(2_000);
  let simulatedActiveMs = 2_000;
  await expect(page.getByTestId("battle-city-status")).toHaveText("Running");
  await page.keyboard.press("p");
  await expect(page.getByTestId("battle-city-status")).toHaveText("Paused");
  await page.clock.runFor(500);
  await page.keyboard.press("p");
  await expect(page.getByTestId("battle-city-status")).toHaveText("Running");

  const endScreen = page.getByTestId("battle-city-end-screen");
  for (let attempt = 0; attempt < 210 && !(await endScreen.isVisible()); attempt += 1) {
    await page.clock.runFor(1_000);
    simulatedActiveMs += 1_000;
  }

  await expect(endScreen).toBeVisible();
  await page.getByTestId("battle-city-save-replay-button").click();
  await expect(page.getByTestId("battle-city-save-replay-button")).toHaveText(
    "Replay saved",
  );

  const parsedReplay = parseBattleCityReplayPayload(savedReplay);

  expect(parsedReplay).toMatchObject({ success: true });
  if (!parsedReplay.success) {
    throw new Error(parsedReplay.error);
  }
  const replay = parsedReplay.payload;

  expect(replay.events[0]).toMatchObject({ type: "start" });
  const firstAdvanceEvent = replay.events.find(
    (event) => event.type === "advance",
  );
  const lastAdvanceEvent = replay.events.findLast(
    (event) => event.type === "advance",
  );

  expect(firstAdvanceEvent?.elapsedMs).toBeLessThan(1_000);
  expect(lastAdvanceEvent?.type).toBe("advance");
  if (lastAdvanceEvent?.type !== "advance") {
    throw new Error("Expected the live replay to end with an advance event.");
  }
  expect(lastAdvanceEvent.endElapsedMs).toBeLessThan(simulatedActiveMs + 1_000);
  expect(replay.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        frameCount: expect.any(Number),
        input: {
          direction: null,
          fireRequested: false,
        },
        type: "advance",
      }),
    ]),
  );
  const pauseEventIndex = replay.events.findIndex(
    (event) => event.type === "pause",
  );
  const resumeEventIndex = replay.events.findIndex(
    (event) => event.type === "resume",
  );
  const pauseEvent = replay.events[pauseEventIndex];
  const resumeEvent = replay.events[resumeEventIndex];

  expect(pauseEventIndex).toBeGreaterThan(0);
  expect(resumeEventIndex).toBeGreaterThan(pauseEventIndex);
  expect(pauseEvent).toMatchObject({
    frameCount: expect.any(Number),
    type: "pause",
  });
  if (pauseEvent?.type !== "pause") {
    throw new Error("Expected the live replay to contain a pause span.");
  }
  expect(pauseEvent.frameCount).toBeGreaterThan(0);
  expect(resumeEvent?.elapsedMs).toBe(pauseEvent.elapsedMs);
  expect(replay.events.length).toBeLessThan(replay.finalTick);

  const finalReplayState = replay.events.reduce(
    (current, event) => applyBattleCityReplayEvent(current, event),
    createInitialBattleCityReplayGame(replay),
  );

  expect(finalReplayState.game).toMatchObject({
    baseAlive: replay.finalBaseAlive,
    cycle: replay.finalCycle,
    lives: replay.finalLives,
    score: replay.finalScore,
    stage: replay.finalStage,
    status: replay.finalStatus,
  });
});

test("Tank Patrol restores the active replay when a replacement run fails", async ({
  page,
}, testInfo) => {
  test.setTimeout(LONG_RUNNING_REPLAY_TEST_TIMEOUT_MS);

  let releaseRestartRun!: () => void;
  let runRequestCount = 0;
  let savedReplay: unknown = null;
  const sessionSubmissions: Array<{ activeDurationMs: number }> = [];
  const restartRunGate = new Promise<void>((resolve) => {
    releaseRestartRun = resolve;
  });

  await page.clock.install({ time: new Date("2026-07-13T12:00:00.000Z") });
  await page.route("**/api/replays/battle-city/run", async (route) => {
    runRequestCount += 1;

    if (runRequestCount === 1) {
      await route.fulfill({
        body: JSON.stringify({ id: "run-preserved", seed: 4_321 }),
        contentType: "application/json",
        status: 201,
      });
      return;
    }

    await restartRunGate;
    await route.fulfill({
      body: JSON.stringify({}),
      contentType: "application/json",
      status: 201,
    });
  });
  await page.route("**/api/replays/battle-city", async (route) => {
    savedReplay = route.request().postDataJSON();
    await route.fulfill({
      body: JSON.stringify({ saved: true }),
      contentType: "application/json",
      status: 201,
    });
  });
  await page.route("**/api/game-sessions", async (route) => {
    sessionSubmissions.push(
      route.request().postDataJSON() as { activeDurationMs: number },
    );
    await route.fulfill({
      body: JSON.stringify({ id: "session-active-restart" }),
      contentType: "application/json",
      status: 201,
    });
  });

  await openLauncher(page);
  await signUpFromLauncher(
    page,
    `Tank AR ${testInfo.workerIndex}${testInfo.retry}${Date.now() % 100_000}`,
  );
  await openGame(page, "battle-city");
  await page.getByTestId("battle-city-start-button").click();
  await page.clock.runFor(2_000);
  await expect(page.getByTestId("battle-city-status")).toHaveText("Running");

  await page.getByTestId("battle-city-board-restart").click();
  await expect(page.getByTestId("battle-city-status")).toHaveText("Running");
  await expect(page.getByTestId("battle-city-back-to-menu")).toBeDisabled();
  await expect(page.getByTestId("battle-city-board-help")).toBeDisabled();
  await page.keyboard.press(" ");
  await page.keyboard.press("p");
  await page.clock.runFor(5_000);
  await expect(page.getByTestId("battle-city-status")).toHaveText("Running");

  releaseRestartRun();
  await expect(page.getByTestId("battle-city-status")).toHaveText("Running");

  const endScreen = page.getByTestId("battle-city-end-screen");
  for (let attempt = 0; attempt < 210 && !(await endScreen.isVisible()); attempt += 1) {
    await page.clock.runFor(1_000);
  }

  await expect(endScreen).toBeVisible();
  await expect.poll(() => sessionSubmissions).toHaveLength(1);
  await page.getByTestId("battle-city-save-replay-button").click();
  await expect(page.getByTestId("battle-city-save-replay-button")).toHaveText(
    "Replay saved",
  );

  const parsedReplay = parseBattleCityReplayPayload(savedReplay);

  expect(parsedReplay).toMatchObject({
    payload: { runId: "run-preserved" },
    success: true,
  });
  const sessionSubmission = sessionSubmissions[0];

  if (!parsedReplay.success || sessionSubmission === undefined) {
    throw new Error("Expected the restored replay and profile session to finish.");
  }

  const replay = parsedReplay.payload;
  const finalAdvanceEvent = replay.events.findLast(
    (event) => event.type === "advance",
  );

  expect(
    replay.events.some(
      (event) => event.type === "advance" && event.input.fireRequested,
    ),
  ).toBe(false);
  expect(finalAdvanceEvent?.type).toBe("advance");
  if (finalAdvanceEvent?.type !== "advance") {
    throw new Error("Expected the restored replay to end with an advance event.");
  }
  expect(
    Math.abs(
      sessionSubmission.activeDurationMs - finalAdvanceEvent.endElapsedMs,
    ),
  ).toBeLessThan(2_000);
});

test("Tank Patrol preserves a completed profile session when restart setup fails", async ({
  page,
}, testInfo) => {
  test.setTimeout(LONG_RUNNING_REPLAY_TEST_TIMEOUT_MS);

  let releaseRestartRun!: () => void;
  let runRequestCount = 0;
  let sessionSubmissionCount = 0;
  const restartRunGate = new Promise<void>((resolve) => {
    releaseRestartRun = resolve;
  });

  await page.clock.install({ time: new Date("2026-07-13T12:00:00.000Z") });
  await page.route("**/api/replays/battle-city/run", async (route) => {
    runRequestCount += 1;

    if (runRequestCount === 1) {
      await route.fulfill({
        body: JSON.stringify({ id: "run-terminal", seed: 4_321 }),
        contentType: "application/json",
        status: 201,
      });
      return;
    }

    await restartRunGate;
    await route.fulfill({
      body: JSON.stringify({}),
      contentType: "application/json",
      status: 201,
    });
  });
  await page.route("**/api/game-sessions", async (route) => {
    sessionSubmissionCount += 1;
    await route.fulfill({
      body: JSON.stringify({ id: `session-${sessionSubmissionCount}` }),
      contentType: "application/json",
      status: 201,
    });
  });

  await openLauncher(page);
  await signUpFromLauncher(
    page,
    `Tank Restart ${testInfo.workerIndex}${testInfo.retry}${Date.now() % 100_000}`,
  );
  await openGame(page, "battle-city");
  await page.getByTestId("battle-city-start-button").click();
  await page.clock.runFor(2_000);

  const endScreen = page.getByTestId("battle-city-end-screen");
  for (let attempt = 0; attempt < 3 && !(await endScreen.isVisible()); attempt += 1) {
    await page.clock.runFor(70_000);
  }

  await expect(endScreen).toBeVisible();
  await expect.poll(() => sessionSubmissionCount).toBe(1);

  await page.getByTestId("battle-city-board-restart").click();
  await expect(page.getByTestId("battle-city-board-restart")).toBeDisabled();
  const pendingStatus = await page
    .getByTestId("battle-city-status")
    .textContent();

  releaseRestartRun();
  expect(pendingStatus).toBe("Game over");
  await expect(page.getByTestId("battle-city-status")).toHaveText("Game over");
  await expect.poll(() => sessionSubmissionCount).toBe(1);
});

function createTerminalReplay(run: BattleCityReplayRun): BattleCityReplayPayload {
  const initialTick = 11;
  const startingStage = 1;
  const startEvent: BattleCityReplayEvent = {
    elapsedMs: 0,
    seq: 0,
    tick: 0,
    type: "start",
  };
  const advanceEvent = {
    elapsedMs: 0,
    endElapsedMs: 0,
    frameCount: 1,
    input: {
      direction: null,
      fireRequested: false,
    },
    seq: 1,
    tick: 0,
    type: "advance",
  } as const;
  let frameCount = 0;
  let replayState = createInitialBattleCityReplayGame({
    initialTick,
    seed: run.seed,
    startingStage,
  });

  replayState = applyBattleCityReplayEvent(replayState, startEvent);

  while (replayState.game.status !== "lost" && frameCount < 20_000) {
    replayState = applyBattleCityReplayAdvanceFrame(
      replayState,
      advanceEvent,
    );
    frameCount += 1;
  }

  if (replayState.game.status !== "lost") {
    throw new Error(
      `Expected generated Tank Patrol browser replay to end lost, got ${replayState.game.status}.`,
    );
  }

  return {
    events: [
      startEvent,
      {
        ...advanceEvent,
        frameCount,
      },
    ],
    finalBaseAlive: replayState.game.baseAlive,
    finalCycle: replayState.game.cycle === 2 ? 2 : 1,
    finalLives: replayState.game.lives,
    finalScore: replayState.game.score,
    finalStage: replayState.game.stage,
    finalStatus: replayState.game.status,
    finalTick: frameCount,
    gameId: "battle-city",
    initialTick,
    leaderboardKey: createBattleCityReplayLeaderboardKey(),
    runId: run.id,
    schemaVersion: BATTLE_CITY_REPLAY_SCHEMA_VERSION,
    seed: run.seed,
    startedAt: "2026-07-13T12:00:00.000Z",
    startingStage,
  };
}

test("Tank Patrol rejects a terminal prefix with unconsumed replay frames", async ({
  page,
}) => {
  const replay = createTerminalReplay({ id: "run-invalid", seed: 4_321 });
  const finalEvent = replay.events.at(-1);

  if (finalEvent?.type !== "advance") {
    throw new Error("Expected the generated replay to end with an advance event.");
  }

  replay.events.push({
    elapsedMs: finalEvent.endElapsedMs,
    endElapsedMs: finalEvent.endElapsedMs,
    frameCount: 1,
    input: {
      direction: null,
      fireRequested: false,
    },
    seq: replay.events.length,
    tick: replay.finalTick,
    type: "advance",
  });
  replay.finalTick += 1;

  await page.route("**/api/replays/battle-city", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ replay }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.goto("/?replay=battle-city");

  await expect(page.getByTestId("battle-city-replay-status")).toHaveText(
    "Replay unavailable",
    { timeout: REPLAY_TERMINAL_EXPECTATION_TIMEOUT_MS },
  );
  await expect(page.getByText(/could not be completed/i)).toBeVisible();
});

test("Tank Patrol saves and plays the signed-in user's latest deterministic replay", async ({
  page,
}, testInfo) => {
  const displayName = `Tank Replay ${testInfo.workerIndex}${testInfo.retry}${Date.now() % 100_000}`;

  await openLauncher(page);
  await signUpFromLauncher(page, displayName);

  const run = await page.evaluate(async () => {
    const response = await fetch("/api/replays/battle-city/run", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Replay run request failed with ${response.status}.`);
    }

    return (await response.json()) as BattleCityReplayRun;
  });
  const replay = createTerminalReplay(run);
  const setup = await page.evaluate(async (payload) => {
    const sessionResponse = await fetch("/api/game-sessions", {
      body: JSON.stringify({
        activeDurationMs: 1_000,
        finalScore: payload.finalScore,
        gameId: payload.gameId,
        leaderboardKey: payload.leaderboardKey,
        result: payload.finalStatus,
        sortDirection: "desc",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const replayResponse = await fetch("/api/replays/battle-city", {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    return {
      replayBody: await replayResponse.text(),
      replayStatus: replayResponse.status,
      sessionBody: await sessionResponse.text(),
      sessionStatus: sessionResponse.status,
    };
  }, replay);

  expect(setup).toMatchObject({
    replayStatus: 201,
    sessionStatus: 201,
  });

  await page.goto("/profile");
  await page.getByTestId("profile-battle-city-last-replay").click();

  await expect(page).toHaveURL("/?replay=battle-city");
  await expect(page.getByTestId("battle-city-replay-finished-screen")).toBeVisible({
    timeout: REPLAY_TERMINAL_EXPECTATION_TIMEOUT_MS,
  });
  await expect(page.getByTestId("battle-city-replay-final-score")).toHaveText(
    replay.finalScore.toLocaleString("en-US"),
  );
  await expect(page.getByTestId("battle-city-replay-stage")).toHaveText(
    String(replay.finalStage),
  );

  await page.getByTestId("battle-city-replay-back-button").click();
  await expect(page).toHaveURL("/profile");
});
