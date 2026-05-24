import { expect, test } from "./support/fixtures";
import { openGame, openLauncher, selectGameParameter } from "./support/app";

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
