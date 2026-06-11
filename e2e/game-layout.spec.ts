import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { openGame, openLauncher } from "./support/app";

const desktopViewport = {
  height: 900,
  width: 1440,
};
const compactDesktopViewport = {
  height: 720,
  width: 1280,
};

const appThemeStorageKey = "game-library-theme";
const centeredBoardTolerancePx = 48;
const alignedEdgeTolerancePx = 1;
const stackedGapPx = 16;
const viewportFitTolerancePx = 1;
const minimumStartScreenContrastRatio = 7;

const layoutCases = [
  {
    boardTestId: "snake-board",
    gameId: "snake",
    name: "Snake",
    palettePrefix: "snake",
    startScreenTestId: "snake-start-screen",
    statsMode: "top-bar",
    statusTestId: "snake-status",
  },
  {
    boardTestId: "tetris-board",
    gameId: "tetris",
    name: "Tetris",
    palettePrefix: "tetris",
    startScreenTestId: "tetris-start-screen",
    statsMode: "top-bar",
    statusTestId: "tetris-status",
  },
  {
    boardTestId: "breakout-board",
    gameId: "breakout",
    name: "Breakout",
    palettePrefix: "breakout",
    startScreenTestId: "breakout-start-screen",
    statsMode: "top-bar",
    statusTestId: "breakout-status",
  },
  {
    boardTestId: "minesweeper-board",
    gameId: "minesweeper",
    name: "Minesweeper",
    palettePrefix: "minesweeper",
    startScreenTestId: "minesweeper-start-screen",
    statsMode: "top-bar",
    statusTestId: "minesweeper-status",
  },
  {
    boardTestId: "space-invaders-board",
    gameId: "space-invaders",
    name: "Space Invaders",
    palettePrefix: "invaders",
    startScreenTestId: "space-invaders-start-screen",
    statsMode: "board-hud",
    statusTestId: "space-invaders-status",
  },
  {
    boardTestId: "pong-board",
    gameId: "pong",
    name: "Pong",
    palettePrefix: "pong",
    startScreenTestId: "pong-start-screen",
    statsMode: "top-bar",
    statusTestId: "pong-status",
  },
  {
    boardTestId: "twenty-forty-eight-board",
    gameId: "twenty-forty-eight",
    name: "2048",
    palettePrefix: "twenty",
    startScreenTestId: "twenty-forty-eight-start-screen",
    statsMode: "top-bar",
    statusTestId: "twenty-forty-eight-status",
  },
  {
    boardTestId: "simon-board",
    gameId: "simon",
    name: "Simon",
    palettePrefix: "simon",
    startScreenTestId: "simon-start-screen",
    statsMode: "top-bar",
    statusTestId: "simon-status",
  },
  {
    boardTestId: "asteroids-board",
    gameId: "asteroids",
    name: "Asteroids",
    palettePrefix: "asteroids",
    startScreenTestId: "asteroids-start-screen",
    statsMode: "top-bar",
    statusTestId: "asteroids-status",
  },
] as const;

const darkPlayfieldPalettePrefixes = new Set([
  "asteroids",
  "breakout",
  "invaders",
  "pong",
  "snake",
  "tetris",
]);

const replayMessageCases = [
  {
    gameId: "snake",
    message: "No Snake replay is available",
    panelBackgroundVariable: "--snake-panel",
  },
  {
    gameId: "simon",
    message: "No Simon replay is available",
    panelBackgroundVariable: "--simon-panel",
  },
] as const;

test.use({ viewport: desktopViewport });

type RgbColor = {
  alpha: number;
  blue: number;
  green: number;
  red: number;
};

function parseCssColor(value: string) {
  const rgbMatch = value.match(
    /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/,
  );

  if (rgbMatch) {
    return {
      alpha: rgbMatch[4] ? Number(rgbMatch[4]) : 1,
      blue: Number(rgbMatch[3]),
      green: Number(rgbMatch[2]),
      red: Number(rgbMatch[1]),
    };
  }

  const srgbMatch = value.match(
    /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/,
  );

  if (srgbMatch) {
    return {
      alpha: srgbMatch[4] ? Number(srgbMatch[4]) : 1,
      blue: Number(srgbMatch[3]) * 255,
      green: Number(srgbMatch[2]) * 255,
      red: Number(srgbMatch[1]) * 255,
    };
  }

  throw new Error(`Unsupported CSS color format: ${value}`);
}

function compositeOverWhite(color: RgbColor) {
  return {
    alpha: 1,
    blue: color.blue * color.alpha + 255 * (1 - color.alpha),
    green: color.green * color.alpha + 255 * (1 - color.alpha),
    red: color.red * color.alpha + 255 * (1 - color.alpha),
  };
}

function getRelativeLuminance(color: RgbColor) {
  const channels = [color.red, color.green, color.blue].map((channel) => {
    const normalized = channel / 255;

    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function getContrastRatio(foreground: RgbColor, background: RgbColor) {
  const foregroundLuminance = getRelativeLuminance(foreground);
  const backgroundLuminance = getRelativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

async function seedDarkAppTheme(page: Page) {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, "dark");
  }, appThemeStorageKey);
}

async function expectResolvedThemeColor(
  page: Page,
  actual: string,
  variableName: string,
  property: "backgroundColor" | "borderColor" | "color",
) {
  const expected = await page.evaluate(
    ({ cssProperty, cssVariable }) => {
      const rootStyles = getComputedStyle(document.documentElement);
      const probe = document.createElement("span");
      const value = rootStyles.getPropertyValue(cssVariable).trim();

      if (cssProperty === "backgroundColor") {
        probe.style.backgroundColor = value;
      } else if (cssProperty === "borderColor") {
        probe.style.borderColor = value;
      } else {
        probe.style.color = value;
      }

      document.body.append(probe);
      const resolvedValue = getComputedStyle(probe)[cssProperty];

      probe.remove();

      return resolvedValue;
    },
    {
      cssProperty: property,
      cssVariable: variableName,
    },
  );

  expect(actual).toBe(expected);
}

async function expectDarkGameChrome(
  page: Page,
  layoutCase: (typeof layoutCases)[number],
) {
  const sample = await page.locator("main").first().evaluate((shell, boardTestId) => {
    const shellStyles = getComputedStyle(shell);
    const sidebar = document.querySelector<HTMLElement>('[data-testid="game-sidebar"]');
    const statCard = sidebar?.querySelector<HTMLElement>("dl > div") ?? null;
    const statLabel = sidebar?.querySelector<HTMLElement>("dt") ?? null;
    const actionButton = document.querySelector<HTMLElement>(
      '[data-testid$="-board-help"]',
    );
    const disabledActionButton = document.querySelector<HTMLElement>(
      '[data-testid$="-board-pause"]:disabled, [data-testid$="-board-restart"]:disabled',
    );
    const board = document.querySelector<HTMLElement>(
      `[data-testid="${boardTestId}"]`,
    );
    const actionButtonStyles = actionButton ? getComputedStyle(actionButton) : null;
    const disabledActionButtonStyles = disabledActionButton
      ? getComputedStyle(disabledActionButton)
      : null;

    return {
      actionButtonBackground: actionButtonStyles?.backgroundColor ?? "",
      actionButtonBorderColor: actionButtonStyles?.borderColor ?? "",
      actionButtonColor: actionButtonStyles?.color ?? "",
      boardFrameBackground: board?.parentElement
        ? getComputedStyle(board.parentElement).backgroundColor
        : "",
      disabledActionButtonOpacity: disabledActionButtonStyles?.opacity ?? "",
      htmlHasDarkClass: document.documentElement.classList.contains("dark"),
      shellBackground: shellStyles.backgroundColor,
      shellColor: shellStyles.color,
      sidebarBackground: sidebar ? getComputedStyle(sidebar).backgroundColor : "",
      sidebarBorderColor: sidebar ? getComputedStyle(sidebar).borderColor : "",
      statCardBorderColor: statCard ? getComputedStyle(statCard).borderColor : "",
      statLabelColor: statLabel ? getComputedStyle(statLabel).color : "",
    };
  }, layoutCase.boardTestId);
  const prefix = layoutCase.palettePrefix;

  expect(sample.htmlHasDarkClass).toBe(true);
  await expectResolvedThemeColor(
    page,
    sample.actionButtonBackground,
    "--game-action-bg",
    "backgroundColor",
  );
  await expectResolvedThemeColor(
    page,
    sample.actionButtonBorderColor,
    "--game-action-border",
    "borderColor",
  );
  await expectResolvedThemeColor(
    page,
    sample.actionButtonColor,
    "--game-action-ink",
    "color",
  );

  if (layoutCase.gameId === "breakout") {
    expect(Number(sample.disabledActionButtonOpacity)).toBeGreaterThanOrEqual(0.69);
  }

  await expectResolvedThemeColor(
    page,
    sample.shellBackground,
    `--${prefix}-page`,
    "backgroundColor",
  );
  await expectResolvedThemeColor(page, sample.shellColor, `--${prefix}-ink`, "color");

  if (layoutCase.statsMode === "top-bar") {
    await expectResolvedThemeColor(
      page,
      sample.sidebarBackground,
      `--${prefix}-panel`,
      "backgroundColor",
    );
    await expectResolvedThemeColor(
      page,
      sample.sidebarBorderColor,
      `--${prefix}-border`,
      "borderColor",
    );
    await expectResolvedThemeColor(
      page,
      sample.statCardBorderColor,
      `--${prefix}-border`,
      "borderColor",
    );
    await expectResolvedThemeColor(
      page,
      sample.statLabelColor,
      `--${prefix}-muted`,
      "color",
    );
  }

  if (darkPlayfieldPalettePrefixes.has(prefix)) {
    await expectResolvedThemeColor(
      page,
      sample.boardFrameBackground,
      `--${prefix}-board`,
      "backgroundColor",
    );
  }

  if (prefix === "simon") {
    await expectResolvedThemeColor(
      page,
      sample.boardFrameBackground,
      "--simon-board-shell",
      "backgroundColor",
    );
  }
}

async function expectDarkReplayMessagePanel(
  page: Page,
  {
    gameId,
    message,
    panelBackgroundVariable,
  }: (typeof replayMessageCases)[number],
) {
  await page.route(`**/api/replays/${gameId}`, async (route) => {
    await route.fulfill({
      body: JSON.stringify({ replay: null }),
      contentType: "application/json",
      status: 200,
    });
  });
  await page.goto(`/?replay=${gameId}`);

  const replayMessage = page.getByText(message, { exact: true });

  await expect(replayMessage).toBeVisible();

  const sample = await replayMessage.evaluate((messageElement) => {
    const panel = messageElement.parentElement;

    return {
      htmlHasDarkClass: document.documentElement.classList.contains("dark"),
      messageColor: getComputedStyle(messageElement).color,
      panelBackground: panel ? getComputedStyle(panel).backgroundColor : "",
      shellColor: getComputedStyle(document.querySelector("main")!).color,
    };
  });

  expect(sample.htmlHasDarkClass).toBe(true);
  expect(sample.messageColor).toBe(sample.shellColor);
  await expectResolvedThemeColor(
    page,
    sample.panelBackground,
    panelBackgroundVariable,
    "backgroundColor",
  );
}

async function expectSharedStartScreenTheme(page: Page, startScreenTestId: string) {
  const startScreen = page.getByTestId(startScreenTestId);

  await expect(startScreen).toBeVisible();
  await expect(startScreen).toHaveAttribute("data-game-start-screen", "true");

  const styles = await startScreen.evaluate((element) => {
    const screenStyle = window.getComputedStyle(element);
    const title = element.querySelector("p");
    const titleStyle = title ? window.getComputedStyle(title) : null;

    return {
      backgroundColor: screenStyle.backgroundColor,
      color: screenStyle.color,
      titleColor: titleStyle?.color ?? "",
    };
  });
  const foreground = parseCssColor(styles.color);
  const background = compositeOverWhite(parseCssColor(styles.backgroundColor));

  expect(styles.titleColor).toBe(styles.color);
  expect(getContrastRatio(foreground, background)).toBeGreaterThanOrEqual(
    minimumStartScreenContrastRatio,
  );
}

async function expectCenteredBoardAndViewportFit(page: Page, boardTestId: string) {
  const board = page.getByTestId(boardTestId);
  const stage = page.getByTestId("game-board-stage");
  const pageScroll = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    scrollY: window.scrollY,
  }));

  await expect(board).toBeVisible();
  await expect(stage).toBeVisible();

  const [boardBox, stageBox] = await Promise.all([
    board.boundingBox(),
    stage.boundingBox(),
  ]);
  const viewport = page.viewportSize();

  expect(boardBox).not.toBeNull();
  expect(stageBox).not.toBeNull();
  expect(viewport).not.toBeNull();

  expect(pageScroll.scrollY).toBeLessThanOrEqual(viewportFitTolerancePx);
  expect(pageScroll.scrollHeight).toBeLessThanOrEqual(
    pageScroll.clientHeight + viewportFitTolerancePx,
  );
  expect(stageBox!.y + stageBox!.height).toBeLessThanOrEqual(
    viewport!.height + viewportFitTolerancePx,
  );

  const boardCenterX = boardBox!.x + boardBox!.width / 2;
  const viewportCenterX = viewport!.width / 2;

  expect(Math.abs(boardCenterX - viewportCenterX)).toBeLessThanOrEqual(
    centeredBoardTolerancePx,
  );

  return { boardBox: boardBox!, stageBox: stageBox!, viewport: viewport! };
}

async function expectCenteredBoardAndTopStatsBar(page: Page, boardTestId: string) {
  const { stageBox } = await expectCenteredBoardAndViewportFit(page, boardTestId);
  const sidebar = page.getByTestId("game-sidebar");
  const statItems = sidebar.locator("dl > div");

  await expect(sidebar).toBeVisible();

  const sidebarBox = await sidebar.boundingBox();

  expect(sidebarBox).not.toBeNull();
  expect(sidebarBox!.y).toBeGreaterThanOrEqual(-viewportFitTolerancePx);
  expect(sidebarBox!.y + sidebarBox!.height).toBeLessThanOrEqual(stageBox!.y);
  expect(stageBox!.y - (sidebarBox!.y + sidebarBox!.height)).toBeLessThanOrEqual(
    stackedGapPx,
  );
  expect(Math.abs(sidebarBox!.x - stageBox!.x)).toBeLessThanOrEqual(
    alignedEdgeTolerancePx,
  );
  expect(Math.abs(sidebarBox!.width - stageBox!.width)).toBeLessThanOrEqual(
    alignedEdgeTolerancePx,
  );

  const statItemCount = await statItems.count();
  expect(statItemCount).toBeGreaterThan(1);
  const statItemBoxes = await Promise.all(
    Array.from({ length: statItemCount }, (_, index) => statItems.nth(index).boundingBox()),
  );
  expect(statItemBoxes.every((box) => box !== null)).toBe(true);
  const statItemTop = statItemBoxes[0]!.y;
  for (const statItemBox of statItemBoxes) {
    expect(Math.abs(statItemBox!.y - statItemTop)).toBeLessThanOrEqual(
      alignedEdgeTolerancePx,
    );
  }
}

async function expectCenteredBoardAndBoardHud(page: Page, boardTestId: string) {
  await page.getByTestId("space-invaders-start-button").click();
  await expect(page.getByTestId("space-invaders-status")).toHaveText("Running");

  const { boardBox, viewport } = await expectCenteredBoardAndViewportFit(page, boardTestId);
  const boardFrame = page.getByTestId("space-invaders-board-frame");
  const healthHud = page.getByTestId("space-invaders-health-hud");
  const scoreHud = page.getByTestId("space-invaders-score-hud");

  await expect(page.getByTestId("game-sidebar")).toHaveCount(0);
  await expect(boardFrame).toBeVisible();
  await expect(healthHud).toBeVisible();
  await expect(scoreHud).toBeVisible();
  await expect(page.getByTestId("space-invaders-lives")).toHaveText("3");
  await expect(page.getByTestId("space-invaders-score")).toHaveText("0");

  const [boardFrameBox, healthBox, scoreBox] = await Promise.all([
    boardFrame.boundingBox(),
    healthHud.boundingBox(),
    scoreHud.boundingBox(),
  ]);

  expect(boardFrameBox).not.toBeNull();
  expect(healthBox).not.toBeNull();
  expect(scoreBox).not.toBeNull();
  expect(boardFrameBox!.y).toBeLessThanOrEqual(viewportFitTolerancePx);
  expect(boardFrameBox!.y + boardFrameBox!.height).toBeGreaterThanOrEqual(
    viewport.height - viewportFitTolerancePx,
  );
  expect(scoreBox!.x).toBeGreaterThanOrEqual(boardBox.x - alignedEdgeTolerancePx);
  expect(scoreBox!.y).toBeGreaterThanOrEqual(boardBox.y - alignedEdgeTolerancePx);
  expect(healthBox!.x + healthBox!.width).toBeLessThanOrEqual(
    boardBox.x + boardBox.width + alignedEdgeTolerancePx,
  );
  expect(healthBox!.y).toBeGreaterThanOrEqual(boardBox.y - alignedEdgeTolerancePx);
}

async function expectGameLayout(page: Page, layoutCase: (typeof layoutCases)[number]) {
  if (layoutCase.statsMode === "board-hud") {
    await expectCenteredBoardAndBoardHud(page, layoutCase.boardTestId);
    return;
  }

  await expectCenteredBoardAndTopStatsBar(page, layoutCase.boardTestId);
}

function getLayoutDescription(layoutCase: (typeof layoutCases)[number]) {
  if (layoutCase.statsMode === "board-hud") {
    return "centers the board with in-board HUD stats";
  }

  return "centers the board below a one-line stats bar";
}

for (const layoutCase of layoutCases) {
  test(`${layoutCase.name} ${getLayoutDescription(layoutCase)}`, async ({ page }) => {
    await openLauncher(page);
    await openGame(page, layoutCase.gameId);

    await expect(page.getByTestId(layoutCase.statusTestId)).toHaveText("Ready");
    await expectSharedStartScreenTheme(page, layoutCase.startScreenTestId);
    await expectGameLayout(page, layoutCase);
  });
}

test.describe("dark app theme game palettes", () => {
  for (const layoutCase of layoutCases) {
    test(`${layoutCase.name} uses dark game chrome tokens`, async ({ page }) => {
      await seedDarkAppTheme(page);
      await openLauncher(page);
      await openGame(page, layoutCase.gameId);

      await expect(page.getByTestId(layoutCase.statusTestId)).toHaveText("Ready");
      await expectDarkGameChrome(page, layoutCase);
    });
  }

  for (const replayMessageCase of replayMessageCases) {
    test(`${replayMessageCase.gameId} replay message uses dark game chrome`, async ({
      page,
    }) => {
      await seedDarkAppTheme(page);
      await expectDarkReplayMessagePanel(page, replayMessageCase);
    });
  }
});

test.describe("compact desktop viewport", () => {
  test.use({ viewport: compactDesktopViewport });

  for (const layoutCase of layoutCases) {
    test(`${layoutCase.name} fits board and stats without page scrolling`, async ({
      page,
    }) => {
      await openLauncher(page);
      await openGame(page, layoutCase.gameId);

      await expect(page.getByTestId(layoutCase.statusTestId)).toHaveText("Ready");
      await expectGameLayout(page, layoutCase);
    });
  }
});
