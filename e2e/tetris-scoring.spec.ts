import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";
import engineFixtures from "../src/lib/replay-compatibility/engines.fixture.json";

test("Tetris scores soft drops at one point and hard drops at three points per cell", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-16T12:00:00Z") });
  await page.route("**/api/replays/tetris/run", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ id: "tetris-scoring", seed: 4321 }),
    status: 201,
  }));
  await openLauncher(page);
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await openGame(page, "tetris");
  await page.clock.pauseAt(new Date("2026-09-16T12:01:00Z"));
  await page.getByTestId("tetris-start-button").click();
  await expect(page.getByTestId("tetris-status")).toHaveText("Running");

  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("tetris-score")).toHaveText("1");
  // The seeded I piece has 17 rows left after the soft drop, with no line clear.
  await page.keyboard.press("Space");
  await expect(page.getByTestId("tetris-score")).toHaveText("52");
  await expect(page.getByTestId("tetris-lines")).toHaveText("0");

  await page.getByTestId("tetris-board-help").click();
  await expect(page.getByTestId("tetris-help-screen")).toContainText(
    "Hard drops score 3 points per cell traversed; soft drops score 1 point per cell.",
  );
});

for (const { schemaVersion, finalScore } of [
  { schemaVersion: 1, finalScore: 217 },
  { schemaVersion: 2, finalScore: 325 },
]) {
  test(`Tetris V${schemaVersion} playback retains its recorded hard-drop scoring`, async ({ page }) => {
    const fixture = engineFixtures.find((entry) => entry.gameId === "tetris")!;
    const events = fixture.eventRuns
      .flatMap(({ event, count }) => Array.from({ length: count }, () => event))
      .map((event, seq) => ({ ...event, elapsedMs: seq * 16, seq, tick: 0 }));
    await page.route("**/api/replays/tetris", (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        replay: { ...fixture.payload, events, schemaVersion, finalScore },
      }),
    }));

    await page.goto("/?replay=tetris");
    await expect(page.getByTestId("tetris-replay-status")).toHaveText("Replay finished");
    await expect(page.getByTestId("tetris-replay-final-score")).toHaveText(String(finalScore));
    await expect(page.getByTestId("tetris-replay-lines")).toHaveText("0");
    await expect(page.getByTestId("tetris-replay-level")).toHaveText("3");
  });
}
