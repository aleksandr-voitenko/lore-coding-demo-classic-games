import type { Locator } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";

async function expectOutsideBoardImage(control: Locator) {
  expect(
    await control.evaluate((element) => element.closest('[role="img"]') === null),
  ).toBe(true);
}

test("Asteroids board overlays keep accessible actions outside the board image", async ({
  page,
}) => {
  await openLauncher(page);
  await openGame(page, "asteroids");

  const boardImage = page.getByRole("img", { name: /^Asteroids board\./ });
  const startButton = page.getByRole("button", { exact: true, name: "Start" });

  await expect(boardImage).toHaveAttribute("data-testid", "asteroids-board");
  await expect(startButton).toBeVisible();
  await expect(boardImage.getByRole("button")).toHaveCount(0);
  await expectOutsideBoardImage(startButton);

  await startButton.click();
  await expect(page.getByTestId("asteroids-status")).toHaveText("Running");

  await page.getByRole("button", { exact: true, name: "Pause" }).click();
  await expect(page.getByTestId("asteroids-status")).toHaveText("Paused");

  const resumeButton = page
    .getByTestId("asteroids-board-state")
    .getByRole("button", { exact: true, name: "Resume" });

  await expect(resumeButton).toBeVisible();
  await expect(boardImage.getByRole("button")).toHaveCount(0);
  await expectOutsideBoardImage(resumeButton);

  await resumeButton.click();
  await expect(page.getByTestId("asteroids-status")).toHaveText("Running");

  const backButton = page.getByRole("button", { name: "Back to game menu" });

  await expect(backButton).toBeVisible();
  await expectOutsideBoardImage(backButton);

  await backButton.click();
  await expect(page.getByTestId("game-abandon-dialog")).toBeVisible();
});
