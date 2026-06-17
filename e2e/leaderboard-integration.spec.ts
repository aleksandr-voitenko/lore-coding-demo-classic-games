import type { APIRequestContext, Page, TestInfo } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { openGame, openLauncher, selectGameParameter } from "./support/app";

type LeaderboardSortDirection = "asc" | "desc";

type LauncherParameter = {
  testId: string;
  value: string;
};

type StartLeaderboardIsolationCase = {
  alternateKey: string;
  alternateParameters: LauncherParameter[];
  alternateScore?: number;
  gameId: string;
  leaderboardTestId: string;
  name: string;
  playerSuffix: string;
  selectedKey: string;
  selectedParameters: LauncherParameter[];
  selectedScore?: number;
  sortDirection?: LeaderboardSortDirection;
};

const startLeaderboardIsolationCases: StartLeaderboardIsolationCase[] = [
  {
    alternateKey: "breakout|board=420x560|lives=3",
    alternateParameters: [
      { testId: "breakout-board-size", value: "420x560" },
      { testId: "breakout-lives", value: "3" },
    ],
    gameId: "breakout",
    leaderboardTestId: "breakout-start-leaderboard",
    name: "Breakout",
    playerSuffix: "BR",
    selectedKey: "breakout|board=480x640|lives=5",
    selectedParameters: [
      { testId: "breakout-board-size", value: "480x640" },
      { testId: "breakout-lives", value: "5" },
    ],
  },
  {
    alternateKey: "minesweeper|difficulty=easy",
    alternateParameters: [{ testId: "minesweeper-difficulty", value: "easy" }],
    alternateScore: 73,
    gameId: "minesweeper",
    leaderboardTestId: "minesweeper-start-leaderboard",
    name: "Minesweeper",
    playerSuffix: "MS",
    selectedKey: "minesweeper|difficulty=medium",
    selectedParameters: [{ testId: "minesweeper-difficulty", value: "medium" }],
    selectedScore: 41,
    sortDirection: "asc",
  },
  {
    alternateKey: "space-invaders|board=420x560|aliens=50",
    alternateParameters: [
      { testId: "space-invaders-board-size", value: "420x560" },
      { testId: "space-invaders-aliens", value: "50" },
    ],
    gameId: "space-invaders",
    leaderboardTestId: "space-invaders-start-leaderboard",
    name: "Space Invaders",
    playerSuffix: "SI",
    selectedKey: "space-invaders|board=540x720|aliens=24",
    selectedParameters: [
      { testId: "space-invaders-board-size", value: "540x720" },
      { testId: "space-invaders-aliens", value: "24" },
    ],
  },
  {
    alternateKey: "twenty-forty-eight|board=4|goal=2048",
    alternateParameters: [
      { testId: "twenty-forty-eight-board-size", value: "4" },
      { testId: "twenty-forty-eight-goal", value: "2048" },
    ],
    gameId: "twenty-forty-eight",
    leaderboardTestId: "twenty-forty-eight-start-leaderboard",
    name: "2048",
    playerSuffix: "TF",
    selectedKey: "twenty-forty-eight|board=6|goal=4096",
    selectedParameters: [
      { testId: "twenty-forty-eight-board-size", value: "6" },
      { testId: "twenty-forty-eight-goal", value: "4096" },
    ],
  },
  {
    alternateKey: "pong|board=420x560|target=5",
    alternateParameters: [
      { testId: "pong-board-size", value: "420x560" },
      { testId: "pong-target", value: "5" },
    ],
    gameId: "pong",
    leaderboardTestId: "pong-start-leaderboard",
    name: "Pong",
    playerSuffix: "PG",
    selectedKey: "pong|board=480x640|target=7",
    selectedParameters: [
      { testId: "pong-board-size", value: "480x640" },
      { testId: "pong-target", value: "7" },
    ],
  },
  {
    alternateKey: "simon|difficulty=medium",
    alternateParameters: [{ testId: "simon-difficulty", value: "medium" }],
    gameId: "simon",
    leaderboardTestId: "simon-start-leaderboard",
    name: "Simon",
    playerSuffix: "SM",
    selectedKey: "simon|difficulty=hard",
    selectedParameters: [{ testId: "simon-difficulty", value: "hard" }],
  },
];

function createPlayerName(testInfo: TestInfo, suffix: string) {
  const runPart = Date.now().toString(36).slice(-5).toUpperCase();

  return `E${testInfo.workerIndex}${testInfo.retry}${runPart}${suffix}`;
}

async function seedLeaderboardRecord(
  request: APIRequestContext,
  {
    leaderboardKey,
    name,
    score,
    sortDirection = "desc",
  }: {
    leaderboardKey: string;
    name: string;
    score: number;
    sortDirection?: LeaderboardSortDirection;
  },
) {
  const response = await request.post("/api/leaderboard", {
    data: {
      leaderboardKey,
      name,
      score,
      sortDirection,
    },
  });

  expect(response.status()).toBe(201);
}

async function selectLauncherParameters(page: Page, parameters: LauncherParameter[]) {
  for (const parameter of parameters) {
    await selectGameParameter(page, parameter.testId, parameter.value);
  }
}

async function expectLeaderboardShowsOnly({
  hiddenPlayer,
  page,
  testId,
  visiblePlayer,
}: {
  hiddenPlayer: string;
  page: Page;
  testId: string;
  visiblePlayer: string;
}) {
  const leaderboard = page.getByTestId(testId);

  await expect(leaderboard).toContainText(visiblePlayer);
  await expect(leaderboard).not.toContainText(hiddenPlayer);
}

test("Tetris leaderboard records stay scoped to launcher parameters", async ({
  page,
  request,
}, testInfo) => {
  const playerName = `E2E-${testInfo.workerIndex}-${Date.now() % 100_000}`;
  const response = await request.post("/api/leaderboard", {
    data: {
      leaderboardKey: "tetris|board=10x20|level=3",
      name: playerName,
      score: 1234,
      sortDirection: "desc",
    },
  });

  expect(response.status()).toBe(201);

  await openLauncher(page);
  await selectGameParameter(page, "tetris-start-level", "3");
  await openGame(page, "tetris");

  await expect(page.getByTestId("tetris-start-leaderboard")).toContainText(playerName);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("game-menu")).toBeVisible();

  await selectGameParameter(page, "tetris-start-level", "1");
  await openGame(page, "tetris");

  await expect(page.getByTestId("tetris-start-leaderboard")).not.toContainText(playerName);
});

for (const leaderboardCase of startLeaderboardIsolationCases) {
  test(`${leaderboardCase.name} start leaderboard records stay scoped to launcher parameters`, async ({
    page,
    request,
  }, testInfo) => {
    const selectedPlayer = createPlayerName(testInfo, `${leaderboardCase.playerSuffix}A`);
    const alternatePlayer = createPlayerName(testInfo, `${leaderboardCase.playerSuffix}B`);

    await seedLeaderboardRecord(request, {
      leaderboardKey: leaderboardCase.selectedKey,
      name: selectedPlayer,
      score: leaderboardCase.selectedScore ?? 900,
      sortDirection: leaderboardCase.sortDirection,
    });
    await seedLeaderboardRecord(request, {
      leaderboardKey: leaderboardCase.alternateKey,
      name: alternatePlayer,
      score: leaderboardCase.alternateScore ?? 600,
      sortDirection: leaderboardCase.sortDirection,
    });

    await openLauncher(page);
    await selectLauncherParameters(page, leaderboardCase.selectedParameters);
    await openGame(page, leaderboardCase.gameId);
    await expectLeaderboardShowsOnly({
      hiddenPlayer: alternatePlayer,
      page,
      testId: leaderboardCase.leaderboardTestId,
      visiblePlayer: selectedPlayer,
    });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("game-menu")).toBeVisible();

    await selectLauncherParameters(page, leaderboardCase.alternateParameters);
    await openGame(page, leaderboardCase.gameId);
    await expectLeaderboardShowsOnly({
      hiddenPlayer: selectedPlayer,
      page,
      testId: leaderboardCase.leaderboardTestId,
      visiblePlayer: alternatePlayer,
    });
  });
}

test("Minesweeper leaderboard API ranks faster selected-parameter clears first", async ({
  request,
}, testInfo) => {
  const selectedKey = "minesweeper|difficulty=hard";
  const alternateKey = "minesweeper|difficulty=easy";
  const fastPlayer = createPlayerName(testInfo, "MSF");
  const slowPlayer = createPlayerName(testInfo, "MSS");
  const alternatePlayer = createPlayerName(testInfo, "MSA");

  await seedLeaderboardRecord(request, {
    leaderboardKey: selectedKey,
    name: slowPlayer,
    score: 73,
    sortDirection: "asc",
  });
  await seedLeaderboardRecord(request, {
    leaderboardKey: selectedKey,
    name: fastPlayer,
    score: 41,
    sortDirection: "asc",
  });
  await seedLeaderboardRecord(request, {
    leaderboardKey: alternateKey,
    name: alternatePlayer,
    score: 29,
    sortDirection: "asc",
  });

  const response = await request.get(
    `/api/leaderboard?key=${encodeURIComponent(selectedKey)}&sort=asc`,
  );

  expect(response.status()).toBe(200);
  await expect(response).toBeOK();

  const payload = await response.json();

  expect(payload.entries).toEqual([
    { name: fastPlayer, score: 41 },
    { name: slowPlayer, score: 73 },
  ]);
  expect(JSON.stringify(payload.entries)).not.toContain(alternatePlayer);
});
