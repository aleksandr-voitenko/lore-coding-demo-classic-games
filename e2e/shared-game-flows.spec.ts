import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";

type RealtimeSharedFlowCase = {
  activeStatus: string;
  gameId: string;
  name: string;
  prefix: string;
  startButtonTestId: string;
};

type SharedHelpThemeCase = {
  gameId: string;
  name: string;
  prefix: string;
};

const realtimeSharedFlowCases: RealtimeSharedFlowCase[] = [
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
    startButtonTestId: "breakout-start-button",
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
    startButtonTestId: "pong-start-button",
  },
  {
    activeStatus: "Running",
    gameId: "asteroids",
    name: "Asteroids",
    prefix: "asteroids",
    startButtonTestId: "asteroids-start-button",
  },
];

const sharedHelpThemeCases: SharedHelpThemeCase[] = [
  { gameId: "snake", name: "Snake", prefix: "snake" },
  { gameId: "tetris", name: "Tetris", prefix: "tetris" },
  { gameId: "breakout", name: "Breakout", prefix: "breakout" },
  { gameId: "minesweeper", name: "Minesweeper", prefix: "minesweeper" },
  {
    gameId: "space-invaders",
    name: "Space Invaders",
    prefix: "space-invaders",
  },
  {
    gameId: "twenty-forty-eight",
    name: "2048",
    prefix: "twenty-forty-eight",
  },
  { gameId: "pong", name: "Pong", prefix: "pong" },
  { gameId: "simon", name: "Simon", prefix: "simon" },
  { gameId: "asteroids", name: "Asteroids", prefix: "asteroids" },
];

function getColorLightness(color: string) {
  const rgbMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);

  if (rgbMatch) {
    return (Math.max(...rgbMatch.slice(1, 4).map(Number)) / 255) * 100;
  }

  const labMatch = color.match(/^lab\((-?\d+(?:\.\d+)?)/);

  if (labMatch) {
    return Number(labMatch[1]);
  }

  const oklabMatch = color.match(/^oklab\(\s*(-?\d+(?:\.\d+)?)(%)?/);

  if (oklabMatch) {
    const lightness = Number(oklabMatch[1]);

    return oklabMatch[2] ? lightness : lightness * 100;
  }

  const oklchMatch = color.match(/^oklch\((\d+(?:\.\d+)?)(%)?/);

  if (oklchMatch) {
    const lightness = Number(oklchMatch[1]);

    return oklchMatch[2] ? lightness : lightness * 100;
  }

  throw new Error(`Expected a measurable color, received "${color}"`);
}

function expectLightColor(color: string) {
  expect(getColorLightness(color)).toBeGreaterThanOrEqual(90);
}

function expectDarkColor(color: string) {
  expect(getColorLightness(color)).toBeLessThanOrEqual(35);
}

test("shared Help color parser accepts browser color serializations", () => {
  expectLightColor("rgb(255, 255, 255)");
  expectLightColor("lab(98.1434 -0.369519 -1.05966)");
  expectLightColor("oklab(0.999994 0.0000455678 0.0000200868)");
  expectLightColor("oklch(0.999994 0.0000455678 0.0000200868)");
  expectDarkColor("lab(7.78673 1.82345 -15.0537)");
});

async function expectAbandonDialogHidden(page: Page) {
  await expect(page.getByTestId("game-abandon-dialog")).toBeHidden();
}

async function expectGameMenuVisible(page: Page) {
  await expect(page.getByTestId("game-menu")).toBeVisible();
}

async function startRealtimeGame(page: Page, flowCase: RealtimeSharedFlowCase) {
  await page.getByTestId(flowCase.startButtonTestId).click();
  await expect(page.getByTestId(`${flowCase.prefix}-status`)).toHaveText(
    flowCase.activeStatus,
  );
}

test("Tetris supports ready Escape, Help pause/resume, and abandon confirmation", async ({
  page,
}) => {
  await openLauncher(page);
  await openGame(page, "tetris");

  await expect(page.getByTestId("tetris-status")).toHaveText("Ready");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("game-menu")).toBeVisible();

  await openGame(page, "tetris");
  await page.getByTestId("tetris-start-button").click();
  await expect(page.getByTestId("tetris-status")).toHaveText("Running");

  await page.getByTestId("tetris-board-help").click();
  await expect(page.getByTestId("tetris-help-screen")).toBeVisible();
  await expect(page.getByTestId("tetris-status")).toHaveText("Paused");

  await page.getByTestId("tetris-help-screen-close").click();
  await expect(page.getByTestId("tetris-help-screen")).toBeHidden();
  await expect(page.getByTestId("tetris-status")).toHaveText("Running");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("game-abandon-dialog")).toBeVisible();
  await expect(page.getByTestId("tetris-status")).toHaveText("Paused");

  await page.getByTestId("game-abandon-cancel").click();
  await expect(page.getByTestId("game-abandon-dialog")).toBeHidden();
  await expect(page.getByTestId("tetris-status")).toHaveText("Running");

  await page.keyboard.press("Escape");
  await page.getByTestId("game-abandon-confirm").click();
  await expect(page.getByTestId("game-menu")).toBeVisible();
});

test("Minesweeper supports flagging and blocks keyboard mode changes while Help is open", async ({
  page,
}) => {
  await openLauncher(page);
  await openGame(page, "minesweeper");

  await expect(page.getByTestId("minesweeper-status")).toHaveText("Ready");
  await expect(page.getByTestId("minesweeper-mines-remaining")).toHaveText("10");
  await expect(page.getByTestId("minesweeper-start-screen")).toBeVisible();
  await expect(page.getByTestId("minesweeper-start-leaderboard")).toBeVisible();
  await expect(page.getByTestId("minesweeper-cell-0:0")).toBeDisabled();

  await page.getByTestId("minesweeper-start-button").click();
  await expect(page.getByTestId("minesweeper-start-screen")).toBeHidden();
  await expect(page.getByTestId("minesweeper-cell-0:0")).toBeEnabled();

  await page.getByTestId("minesweeper-cell-0:0").click({ button: "right" });
  await expect(page.getByTestId("minesweeper-cell-0:0")).toHaveAccessibleName(
    "Column 1, row 1. Flagged.",
  );
  await expect(page.getByTestId("minesweeper-mines-remaining")).toHaveText("9");

  await page.getByTestId("minesweeper-board-help").click();
  await expect(page.getByTestId("minesweeper-help-screen")).toBeVisible();

  await page.keyboard.press("m");
  await page.keyboard.press("Escape");

  await expect(page.getByTestId("minesweeper-help-screen")).toBeHidden();
  await expect(page.getByTestId("minesweeper-active-mode")).toHaveText("Reveal");
});

for (const flowCase of realtimeSharedFlowCases) {
  test(`${flowCase.name} supports shared realtime Back, Help, Pause, Restart, and Escape flows`, async ({
    page,
  }) => {
    const status = page.getByTestId(`${flowCase.prefix}-status`);
    const backButton = page.getByTestId(`${flowCase.prefix}-back-to-menu`);
    const helpButton = page.getByTestId(`${flowCase.prefix}-board-help`);
    const helpScreen = page.getByTestId(`${flowCase.prefix}-help-screen`);
    const pauseButton = page.getByTestId(`${flowCase.prefix}-board-pause`);
    const restartButton = page.getByTestId(`${flowCase.prefix}-board-restart`);

    await openLauncher(page);
    await openGame(page, flowCase.gameId);

    await expect(status).toHaveText("Ready");
    await expect(pauseButton).toBeDisabled();
    await expect(restartButton).toBeDisabled();

    await backButton.click();
    await expectGameMenuVisible(page);

    await openGame(page, flowCase.gameId);
    await startRealtimeGame(page, flowCase);

    await helpButton.click();
    await expect(helpScreen).toBeVisible();
    await expect(status).toHaveText("Paused");
    await expect(pauseButton).toBeDisabled();

    await page.keyboard.press("Escape");
    await expect(helpScreen).toBeHidden();
    await expect(status).toHaveText(flowCase.activeStatus);

    await pauseButton.click();
    await expect(status).toHaveText("Paused");
    await expect(pauseButton).toHaveAccessibleName("Resume");

    await pauseButton.click();
    await expect(status).toHaveText(flowCase.activeStatus);
    await expect(pauseButton).toHaveAccessibleName("Pause");

    await restartButton.click();
    await expect(status).toHaveText(flowCase.activeStatus);

    await backButton.click();
    await expect(page.getByTestId("game-abandon-dialog")).toBeVisible();
    await expect(status).toHaveText("Paused");

    await page.getByTestId("game-abandon-cancel").click();
    await expectAbandonDialogHidden(page);
    await expect(status).toHaveText(flowCase.activeStatus);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("game-abandon-dialog")).toBeVisible();
    await expect(status).toHaveText("Paused");

    await page.getByTestId("game-abandon-confirm").click();
    await expectGameMenuVisible(page);
  });
}

test("shared Help layout keeps Rules adjacent to compact Controls", async ({ page }) => {
  await openLauncher(page);
  await openGame(page, "simon");

  await page.getByTestId("simon-board-help").click();

  const helpScreen = page.getByTestId("simon-help-screen");
  const controlCards = helpScreen.locator("section").first().locator(":scope > div > div > div");
  const rulesHeading = helpScreen.getByRole("heading", { name: "Rules" });

  await expect(helpScreen).toBeVisible();
  await expect(controlCards.first()).toBeVisible();
  await expect(rulesHeading).toBeVisible();

  const controlCardCount = await controlCards.count();
  expect(controlCardCount).toBeGreaterThan(0);

  const controlBoxes = await Promise.all(
    Array.from({ length: controlCardCount }, async (_, index) =>
      controlCards.nth(index).boundingBox(),
    ),
  );
  const controlRightEdge = Math.max(
    ...controlBoxes.map((box) => {
      expect(box).not.toBeNull();

      return box!.x + box!.width;
    }),
  );
  const rulesBox = await rulesHeading.boundingBox();

  expect(rulesBox).not.toBeNull();
  expect(rulesBox!.x - controlRightEdge).toBeLessThanOrEqual(24);
});

test("shared Help theme stays light for every game", async ({ page }) => {
  for (const helpCase of sharedHelpThemeCases) {
    await openLauncher(page);
    await openGame(page, helpCase.gameId);

    await page.getByTestId(`${helpCase.prefix}-board-help`).click();

    const helpScreenTestId = `${helpCase.prefix}-help-screen`;
    const helpScreen = page.getByTestId(helpScreenTestId);

    await expect(helpScreen).toBeVisible();

    const colors = await page.evaluate((testId) => {
      const dialog = document.querySelector(`[data-testid="${testId}"] > div`);
      const closeButton = document.querySelector(`[data-testid="${testId}-close"]`);

      if (!dialog || !closeButton) {
        throw new Error(`Missing Help theme target for ${testId}`);
      }

      const dialogStyle = window.getComputedStyle(dialog);
      const closeButtonStyle = window.getComputedStyle(closeButton);

      return {
        closeBackground: closeButtonStyle.backgroundColor,
        closeText: closeButtonStyle.color,
        dialogBackground: dialogStyle.backgroundColor,
        dialogText: dialogStyle.color,
      };
    }, helpScreenTestId);

    expectLightColor(colors.dialogBackground);
    expectDarkColor(colors.dialogText);
    expectLightColor(colors.closeBackground);
    expectDarkColor(colors.closeText);

    await page.getByTestId(`${helpScreenTestId}-close`).click();
    await expect(helpScreen).toBeHidden();
  }
});

test("shared Help keeps long Rules scrolling inside the rules list", async ({ page }) => {
  await openLauncher(page);
  await openGame(page, "space-invaders");

  await page.getByTestId("space-invaders-board-help").click();

  const helpScreen = page.getByTestId("space-invaders-help-screen");

  await expect(helpScreen).toBeVisible();

  const scrollState = await page.evaluate(() => {
    const dialog = document.querySelector('[data-testid="space-invaders-help-screen"] > div');

    if (!(dialog instanceof HTMLElement)) {
      throw new Error("Missing Space Invaders Help dialog");
    }

    const sections = Array.from(dialog.querySelectorAll("section"));
    const controlsList = sections[0]?.querySelector(":scope > div");
    const controlsGrid = controlsList?.firstElementChild;
    const controlCards =
      controlsGrid instanceof HTMLElement
        ? Array.from(controlsGrid.children).filter(
            (child): child is HTMLElement => child instanceof HTMLElement,
          )
        : [];
    const rulesSection = sections.find(
      (section) => section.querySelector("h3")?.textContent === "Rules",
    );
    const rulesList = rulesSection?.querySelector("ul");

    if (controlCards.length === 0 || !(rulesList instanceof HTMLElement)) {
      throw new Error("Missing Space Invaders Help scroll targets");
    }

    dialog.scrollTop = 0;
    rulesList.scrollTop = 0;

    const controlsCard = controlCards[0];
    const controlsTopBefore = controlsCard.getBoundingClientRect().top;

    rulesList.scrollTop = rulesList.scrollHeight;

    return {
      largestControlsCardHeight: Math.max(
        ...controlCards.map((card) => card.getBoundingClientRect().height),
      ),
      controlsTopDelta: Math.abs(
        controlsCard.getBoundingClientRect().top - controlsTopBefore,
      ),
      dialogClientHeight: dialog.clientHeight,
      dialogScrollHeight: dialog.scrollHeight,
      dialogScrollTop: dialog.scrollTop,
      rulesClientHeight: rulesList.clientHeight,
      rulesScrollHeight: rulesList.scrollHeight,
      rulesScrollTop: rulesList.scrollTop,
    };
  });

  expect(scrollState.rulesScrollHeight).toBeGreaterThan(
    scrollState.rulesClientHeight + 1,
  );
  expect(scrollState.rulesScrollTop).toBeGreaterThan(0);
  expect(scrollState.dialogScrollHeight).toBeLessThanOrEqual(
    scrollState.dialogClientHeight + 1,
  );
  expect(scrollState.dialogScrollTop).toBe(0);
  expect(scrollState.controlsTopDelta).toBeLessThanOrEqual(1);
  expect(scrollState.largestControlsCardHeight).toBeLessThanOrEqual(96);
});

test("shared Help keeps long Controls scrolling inside the controls list", async ({ page }) => {
  await openLauncher(page);
  await openGame(page, "tetris");

  await page.getByTestId("tetris-board-help").click();

  const helpScreen = page.getByTestId("tetris-help-screen");

  await expect(helpScreen).toBeVisible();

  const scrollState = await page.evaluate(() => {
    const dialog = document.querySelector('[data-testid="tetris-help-screen"] > div');

    if (!(dialog instanceof HTMLElement)) {
      throw new Error("Missing Tetris Help dialog");
    }

    const sections = Array.from(dialog.querySelectorAll("section"));
    const controlsSection = sections.find(
      (section) => section.querySelector("h3")?.textContent === "Controls",
    );
    const controlsList = controlsSection?.querySelector("div");
    const rulesHeading = sections
      .find((section) => section.querySelector("h3")?.textContent === "Rules")
      ?.querySelector("h3");

    if (!(controlsList instanceof HTMLElement) || !(rulesHeading instanceof HTMLElement)) {
      throw new Error("Missing Tetris Help scroll targets");
    }

    dialog.scrollTop = 0;
    controlsList.scrollTop = 0;

    const rulesTopBefore = rulesHeading.getBoundingClientRect().top;

    controlsList.scrollTop = controlsList.scrollHeight;

    return {
      controlsClientHeight: controlsList.clientHeight,
      controlsScrollHeight: controlsList.scrollHeight,
      controlsScrollTop: controlsList.scrollTop,
      dialogClientHeight: dialog.clientHeight,
      dialogScrollHeight: dialog.scrollHeight,
      dialogScrollTop: dialog.scrollTop,
      rulesTopDelta: Math.abs(rulesHeading.getBoundingClientRect().top - rulesTopBefore),
    };
  });

  expect(scrollState.controlsScrollHeight).toBeGreaterThan(
    scrollState.controlsClientHeight + 1,
  );
  expect(scrollState.controlsScrollTop).toBeGreaterThan(0);
  expect(scrollState.dialogScrollHeight).toBeLessThanOrEqual(
    scrollState.dialogClientHeight + 1,
  );
  expect(scrollState.dialogScrollTop).toBe(0);
  expect(scrollState.rulesTopDelta).toBeLessThanOrEqual(1);
});

test("2048 supports shared turn-based Help, Restart, Back, and Escape flows without Pause", async ({
  page,
}) => {
  await openLauncher(page);
  await openGame(page, "twenty-forty-eight");

  const status = page.getByTestId("twenty-forty-eight-status");
  const helpScreen = page.getByTestId("twenty-forty-eight-help-screen");
  const pauseButton = page.getByTestId("twenty-forty-eight-board-pause");

  await expect(status).toHaveText("Ready");
  await expect(pauseButton).toHaveCount(0);

  await page.getByTestId("twenty-forty-eight-board-help").click();
  await expect(helpScreen).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(helpScreen).toBeHidden();
  await expect(status).toHaveText("Ready");

  await page.keyboard.press("Escape");
  await expectGameMenuVisible(page);

  await openGame(page, "twenty-forty-eight");
  await page.getByTestId("twenty-forty-eight-overlay-start-button").click();

  await expect(status).toHaveText("Running");
  await expect(pauseButton).toHaveCount(0);

  await page.getByTestId("twenty-forty-eight-board-help").click();
  await expect(helpScreen).toBeVisible();
  await expect(status).toHaveText("Running");

  await page.keyboard.press("Escape");
  await expect(helpScreen).toBeHidden();
  await expect(status).toHaveText("Running");

  await page.getByTestId("twenty-forty-eight-board-restart").click();
  await expect(status).toHaveText("Ready");

  await page.getByTestId("twenty-forty-eight-overlay-start-button").click();
  await expect(status).toHaveText("Running");

  await page.getByTestId("twenty-forty-eight-back-to-menu").click();
  await expect(page.getByTestId("game-abandon-dialog")).toBeVisible();
  await expect(status).toHaveText("Running");

  await page.getByTestId("game-abandon-cancel").click();
  await expectAbandonDialogHidden(page);
  await expect(status).toHaveText("Running");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("game-abandon-dialog")).toBeVisible();
  await expect(status).toHaveText("Running");

  await page.getByTestId("game-abandon-confirm").click();
  await expectGameMenuVisible(page);
});
