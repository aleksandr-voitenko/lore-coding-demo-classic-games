import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import {
  expectSignedInProfileMenu,
  logInFromLauncher,
  openGame,
  openLauncher,
  openProfileFromLauncher,
  openProfileMenu,
  selectGameParameter,
  signOutFromLauncher,
  signUpFromLauncher,
} from "./support/app";

const appThemeStorageKey = "game-library-theme";
const themeCleanupSessionFlag = "game-library-theme-cleaned";
const themeSeedSessionFlag = "game-library-theme-seeded";

const gameCardIds = [
  "snake",
  "tetris",
  "breakout",
  "minesweeper",
  "space-invaders",
  "twenty-forty-eight",
  "pong",
  "simon",
  "asteroids",
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

type ChromeThemeSample = {
  background: string;
  color: string;
  expectedBackground: string;
  expectedColor: string;
  htmlHasDarkClass: boolean;
  storedTheme: string | null;
};

const launcherParameterHandoffCases: LauncherParameterHandoffCase[] = [
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
      await expect(page.getByTestId("space-invaders-score")).toHaveText("0");
      await expect(page.getByTestId("space-invaders-lives")).toHaveText("3");
      await expect(page.getByTestId("space-invaders-invader")).toHaveCount(24);
      await expect(page.getByTestId("space-invaders-board")).toHaveAttribute(
        "aria-label",
        /Space Invaders board\. Field 540 by 720\. Score 0\. Lives 3\. 24 invaders remaining\. 0 power ups falling\. Ready\./,
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
  {
    assertGameSeeded: async (page) => {
      await expect(page.getByTestId("asteroids-status")).toHaveText("Ready");
      await expect(page.getByTestId("asteroids-lives")).toHaveText("2");
      await expect(page.getByTestId("asteroids-rocks")).toHaveText("5");
      await expect(page.getByTestId("asteroids-board")).toHaveAttribute(
        "aria-label",
        /Asteroids board\. Field 800 by 600\. Score 0\. Lives 2\. Wave 1\. 5 asteroids remaining\. Ready\./,
      );
    },
    gameId: "asteroids",
    name: "Asteroids difficulty",
    parameters: [{ testId: "asteroids-difficulty", value: "hard" }],
  },
];

async function expectChromeUsesAppTheme(
  page: Page,
  testId: string,
  expectedTheme: "dark" | "light",
  backgroundVariable = "--chrome-page",
) {
  const sample = await page
    .getByTestId(testId)
    .evaluate(
      (
        element,
        {
          expectedBackgroundVariable,
          storageKey,
          targetTestId,
        }: {
          expectedBackgroundVariable: string;
          storageKey: string;
          targetTestId: string;
        },
      ): ChromeThemeSample => {
        const rootStyles = getComputedStyle(document.documentElement);
        const probe = document.createElement("span");

        probe.style.backgroundColor = rootStyles
          .getPropertyValue(expectedBackgroundVariable)
          .trim();
        probe.style.color = rootStyles.getPropertyValue("--chrome-ink").trim();
        document.body.append(probe);

        const elementStyles = getComputedStyle(element);
        const probeStyles = getComputedStyle(probe);
        const sample = {
          background: elementStyles.backgroundColor,
          color: elementStyles.color,
          expectedBackground: probeStyles.backgroundColor,
          expectedColor: probeStyles.color,
          htmlHasDarkClass: document.documentElement.classList.contains("dark"),
          storedTheme: window.localStorage.getItem(storageKey),
        };

        probe.remove();

        if (element.dataset.testid !== targetTestId) {
          throw new Error(`Expected ${targetTestId} chrome sample.`);
        }

        return sample;
      },
      {
        expectedBackgroundVariable: backgroundVariable,
        storageKey: appThemeStorageKey,
        targetTestId: testId,
      },
    );

  expect(sample.background).toBe(sample.expectedBackground);
  expect(sample.color).toBe(sample.expectedColor);
  expect(sample.htmlHasDarkClass).toBe(expectedTheme === "dark");
  expect(sample.storedTheme).toBe(expectedTheme);
}

async function expectThemeToggleSwitchChrome(page: Page, testId: string) {
  const toggle = page.getByTestId(testId);

  await expect(toggle.locator("[data-theme-toggle-thumb]")).toHaveCount(1);
  await expect(toggle.locator('[data-theme-icon="sun"]')).toHaveCount(1);
  await expect(toggle.locator('[data-theme-icon="moon"]')).toHaveCount(1);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ cleanupFlag, seedFlag, storageKey }) => {
    if (window.sessionStorage.getItem(cleanupFlag) === "1") {
      return;
    }

    window.localStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(seedFlag);
    window.sessionStorage.setItem(cleanupFlag, "1");

    const root = document.documentElement;

    if (root) {
      root.classList.remove("dark");
      root.style.setProperty("color-scheme", "light");
    }
  }, {
    cleanupFlag: themeCleanupSessionFlag,
    seedFlag: themeSeedSessionFlag,
    storageKey: appThemeStorageKey,
  });
});

test("launcher renders game cards and configurable parameters", async ({ page }) => {
  await openLauncher(page);

  for (const gameId of gameCardIds) {
    await expect(page.getByTestId(`game-card-${gameId}`)).toBeVisible();
  }

  await expect(page.getByText("9 games available")).toBeVisible();
  await expect(page.getByTestId("snake-board-size")).toHaveCount(0);
  await expect(page.getByTestId("tetris-board-size")).toHaveValue("10x20");
  await expect(page.getByTestId("tetris-start-level")).toHaveValue("1");
  await expect(page.getByTestId("minesweeper-mines")).toHaveValue("10");
  await expect(page.getByTestId("asteroids-board-size")).toHaveCount(0);
  await expect(page.getByTestId("asteroids-rocks")).toHaveCount(0);
  await expect(page.getByTestId("asteroids-difficulty")).toHaveValue("medium");
});

test("theme switching persists from launcher controls into profile chrome", async ({
  page,
}) => {
  await page.addInitScript(({ flagKey, storageKey }) => {
    if (window.sessionStorage.getItem(flagKey) === "1") {
      return;
    }

    window.localStorage.setItem(storageKey, "dark");
    window.sessionStorage.setItem(flagKey, "1");
  }, {
    flagKey: themeSeedSessionFlag,
    storageKey: appThemeStorageKey,
  });

  await openLauncher(page);

  await expect(page.getByTestId("launcher-theme-toggle")).toHaveAccessibleName(
    "Switch to light mode",
  );
  await expect(page.getByTestId("launcher-theme-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectThemeToggleSwitchChrome(page, "launcher-theme-toggle");
  await expectChromeUsesAppTheme(page, "game-menu", "dark");

  await page.getByTestId("launcher-theme-toggle").click();
  await expect(page.getByTestId("launcher-theme-toggle")).toHaveAccessibleName(
    "Switch to dark mode",
  );
  await expect(page.getByTestId("launcher-theme-toggle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expectChromeUsesAppTheme(page, "game-menu", "light");

  await page.getByTestId("sign-up-open-button").click();
  await expect(page.getByTestId("auth-dialog")).toBeVisible();
  await expectThemeToggleSwitchChrome(page, "auth-theme-toggle");
  await page.getByTestId("auth-theme-toggle").click();
  await expect(page.getByTestId("auth-theme-toggle")).toHaveAccessibleName(
    "Switch to light mode",
  );
  await expect(page.getByTestId("auth-theme-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectChromeUsesAppTheme(page, "auth-dialog", "dark", "--chrome-panel");
  await page.getByTestId("auth-displayName-input").fill("Theme Hero");
  await page.getByTestId("auth-password-input").fill("password123");
  await page.getByTestId("auth-passwordConfirmation-input").fill("password123");
  await page.getByTestId("auth-submit-button").click();
  await expectSignedInProfileMenu(page, "Theme Hero");
  await expectChromeUsesAppTheme(page, "game-menu", "dark");

  await openProfileMenu(page);
  await expectChromeUsesAppTheme(page, "profile-menu", "dark", "--chrome-panel");
  await expect(page.getByTestId("profile-menu-theme-toggle")).toHaveCount(0);
  await expect(page.getByTestId("profile-menu")).not.toContainText(/Dark mode|Light mode/);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("profile-menu")).toHaveCount(0);

  await page.getByTestId("launcher-theme-toggle").click();
  await expectChromeUsesAppTheme(page, "game-menu", "light");

  await page.reload();
  await expect(page.getByTestId("game-menu")).toBeVisible();
  await expectChromeUsesAppTheme(page, "game-menu", "light");

  await page.getByTestId("launcher-theme-toggle").click();
  await openProfileFromLauncher(page);
  await expect(page.getByRole("heading", { name: "Theme Hero" })).toBeVisible();
  await expect(page.getByTestId("profile-theme-toggle")).toHaveCount(0);
  await expectChromeUsesAppTheme(page, "profile-page", "dark");

  await page.getByRole("link", { name: "Back to games" }).click();
  await expect(page.getByTestId("game-menu")).toBeVisible();
  await expect(page.getByTestId("launcher-theme-toggle")).toHaveAccessibleName(
    "Switch to light mode",
  );
  await expectChromeUsesAppTheme(page, "game-menu", "dark");
});

test("Snake opens in level progression mode at level one", async ({ page }) => {
  await openLauncher(page);
  await openGame(page, "snake");

  await expect(page.getByTestId("snake-status")).toHaveText("Ready");
  await expect(page.getByTestId("snake-level")).toHaveText("1");
  await expect(page.getByTestId("snake-board")).toHaveAttribute(
    "aria-label",
    /Snake board\. Level 1\. Field 12 by 12\. Score 0\. Ready\..*Exit door closed\./,
  );
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

test("launcher restores its scroll position after returning from a game", async ({
  page,
}) => {
  await openLauncher(page);

  await page.getByTestId("game-card-simon").scrollIntoViewIfNeeded();
  const menuScrollY = await page.evaluate(() => window.scrollY);

  expect(menuScrollY).toBeGreaterThan(0);

  await openGame(page, "simon");
  await expect(page.getByTestId("simon-status")).toHaveText("Ready");

  await page.getByTestId("simon-back-to-menu").click();
  await expect(page.getByTestId("game-menu")).toBeVisible();
  await page.waitForFunction(
    (targetY) => Math.abs(window.scrollY - targetY) <= 1,
    menuScrollY,
  );

  const restoredScrollY = await page.evaluate(() => window.scrollY);

  expect(restoredScrollY).toBeGreaterThanOrEqual(menuScrollY - 1);
  expect(restoredScrollY).toBeLessThanOrEqual(menuScrollY + 1);
});

test("launcher hydrates the signed-in user before client account refreshes", async ({ page }) => {
  await openLauncher(page);

  await signUpFromLauncher(page, "E2E Hero");

  await openProfileFromLauncher(page);
  await expect(page.getByRole("heading", { name: "E2E Hero" })).toBeVisible();

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ user: null }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.getByRole("link", { name: "Back to games" }).click();
  await expect(page.getByTestId("game-menu")).toBeVisible();
  await expectSignedInProfileMenu(page, "E2E Hero");
  await expect(page.getByTestId("auth-displayName-input")).toHaveCount(0);
});

test("launcher renders signed-in account controls as one circular profile menu", async ({
  page,
}) => {
  await openLauncher(page);

  await signUpFromLauncher(page, "Menu Hero");

  const accountActionMetrics = await page.getByTestId("user-account-controls").evaluate((element) => {
    const profileMenuTrigger = element.querySelector('[data-testid="profile-menu-trigger"]');

    if (!(profileMenuTrigger instanceof HTMLElement)) {
      throw new Error("Signed-in account controls did not render a profile menu trigger.");
    }

    const triggerRect = profileMenuTrigger.getBoundingClientRect();
    const triggerStyle = getComputedStyle(profileMenuTrigger);

    return {
      borderRadius: Number.parseFloat(triggerStyle.borderTopLeftRadius),
      buttonCount: element.querySelectorAll("button").length,
      containerBackground: getComputedStyle(element).backgroundColor,
      height: triggerRect.height,
      hasClosedProfileLink: element.querySelector('[data-testid="profile-link"]') !== null,
      hasClosedSignOutButton: element.querySelector('[data-testid="sign-out-button"]') !== null,
      width: triggerRect.width,
    };
  });

  expect(accountActionMetrics.containerBackground).toBe("rgba(0, 0, 0, 0)");
  expect(accountActionMetrics.buttonCount).toBe(1);
  expect(accountActionMetrics.width).toBeGreaterThanOrEqual(39);
  expect(accountActionMetrics.width).toBeLessThanOrEqual(41);
  expect(accountActionMetrics.height).toBeGreaterThanOrEqual(39);
  expect(accountActionMetrics.height).toBeLessThanOrEqual(41);
  expect(accountActionMetrics.borderRadius).toBeGreaterThanOrEqual(20);
  expect(accountActionMetrics.hasClosedProfileLink).toBe(false);
  expect(accountActionMetrics.hasClosedSignOutButton).toBe(false);

  const profileMenuTrigger = page.getByTestId("profile-menu-trigger");
  const profileMenuTooltip = page.getByTestId("profile-menu-tooltip");

  await expect(profileMenuTrigger).toHaveAttribute("aria-describedby", "profile-menu-tooltip");
  await expect(profileMenuTooltip).toHaveText("Open user navigation menu");
  await expect(profileMenuTooltip).toHaveCSS("opacity", "0");
  await profileMenuTrigger.hover();
  await expect(profileMenuTooltip).toHaveCSS("opacity", "1");
  const tooltipTheme = await profileMenuTooltip.evaluate((element) => {
    const rootStyles = getComputedStyle(document.documentElement);
    const probe = document.createElement("span");

    probe.style.backgroundColor = rootStyles.getPropertyValue("--chrome-panel").trim();
    probe.style.borderColor = rootStyles.getPropertyValue("--chrome-border").trim();
    probe.style.color = rootStyles.getPropertyValue("--chrome-ink").trim();
    document.body.append(probe);

    const tooltipStyles = getComputedStyle(element);
    const probeStyles = getComputedStyle(probe);
    const colors = {
      borderColor: tooltipStyles.borderTopColor,
      expectedBorderColor: probeStyles.borderTopColor,
      expectedBackground: probeStyles.backgroundColor,
      expectedColor: probeStyles.color,
      background: tooltipStyles.backgroundColor,
      color: tooltipStyles.color,
    };

    probe.remove();
    return colors;
  });

  expect(tooltipTheme.background).toBe(tooltipTheme.expectedBackground);
  expect(tooltipTheme.borderColor).toBe(tooltipTheme.expectedBorderColor);
  expect(tooltipTheme.color).toBe(tooltipTheme.expectedColor);
  expect(await profileMenuTooltip.evaluate((element) => {
    const style = getComputedStyle(element);

    return {
      duration: style.transitionDuration,
      property: style.transitionProperty,
    };
  })).toEqual({
    duration: "0.15s",
    property: "opacity, transform",
  });

  await openProfileMenu(page);

  await expect(page.getByTestId("profile-menu-tooltip")).toHaveCount(0);
  expect(await page.getByTestId("profile-menu").evaluate((element) => {
    const style = getComputedStyle(element);

    return {
      duration: style.transitionDuration,
      origin: style.transformOrigin,
      property: style.transitionProperty,
    };
  })).toMatchObject({
    duration: "0.15s",
    property: "opacity, transform",
  });
  await expect(page.getByTestId("profile-link")).toHaveText("Profile");
  await expect(page.getByTestId("profile-menu-theme-toggle")).toHaveCount(0);
  await expect(page.getByTestId("profile-menu")).not.toContainText(/Dark mode|Light mode/);
  await expect(page.getByTestId("sign-out-button")).toHaveText("Log out");

  await page.mouse.move(16, 16);
  await page.mouse.click(16, 16);

  await expect(page.getByTestId("profile-menu")).toHaveCount(0);
  await expect(page.getByTestId("profile-menu-tooltip")).toHaveCSS("opacity", "0");
  await profileMenuTrigger.focus();
  await expect(page.getByTestId("profile-menu-tooltip")).toHaveCSS("opacity", "0");
});

test("auth modal validates signup passwords before submitting", async ({ page }) => {
  await openLauncher(page);

  await page.getByTestId("sign-up-open-button").click();
  await expect(page.getByTestId("auth-dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign up" })).toBeVisible();
  const authTitleMetrics = await page
    .getByRole("heading", { name: "Sign up" })
    .evaluate((element) => {
      const dialog = element.closest('[data-testid="auth-dialog"]');

      if (dialog === null) {
        return null;
      }

      const titleRect = element.getBoundingClientRect();
      const dialogRect = dialog.getBoundingClientRect();

      return {
        dialogCenter: dialogRect.left + dialogRect.width / 2,
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        textAlign: getComputedStyle(element).textAlign,
        titleCenter: titleRect.left + titleRect.width / 2,
      };
    });

  expect(authTitleMetrics).not.toBeNull();
  expect(authTitleMetrics?.fontSize).toBeGreaterThanOrEqual(30);
  expect(authTitleMetrics?.textAlign).toBe("center");
  expect(
    Math.abs((authTitleMetrics?.dialogCenter ?? 0) - (authTitleMetrics?.titleCenter ?? 0)),
  ).toBeLessThanOrEqual(1);
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByLabel("User name")).toBeVisible();
  await expect(page.getByText("Display name")).toHaveCount(0);
  await expect(page.getByText("Sign up to Game Library")).toHaveCount(0);
  await expect(
    page.getByText("Use your player name and password. No email is required."),
  ).toHaveCount(0);
  await page.getByTestId("auth-displayName-input").fill("Mismatch Hero");
  await page.getByTestId("auth-password-input").fill("password123");
  await page.getByTestId("auth-passwordConfirmation-input").fill("different123");
  await page.getByTestId("auth-submit-button").click();

  await expect(page.getByTestId("auth-passwordConfirmation-input")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  const passwordMatchError = page.getByText("Passwords must match.");
  await expect(passwordMatchError).toBeVisible();
  const errorColor = await passwordMatchError.evaluate((element) => {
    const probe = document.createElement("span");
    probe.style.color = getComputedStyle(document.documentElement)
      .getPropertyValue("--destructive")
      .trim();
    document.body.append(probe);

    const colors = {
      actual: getComputedStyle(element).color,
      destructive: getComputedStyle(probe).color,
    };

    probe.remove();
    return colors;
  });
  expect(errorColor.actual).toBe(errorColor.destructive);

  const submitButtonMarginTop = await page
    .getByTestId("auth-submit-button")
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).marginTop));
  expect(submitButtonMarginTop).toBeGreaterThan(0);
  await expect(page.getByTestId("profile-link")).toHaveCount(0);
});

test("auth modal reports duplicate signup names next to the name field", async ({
  browserIssues,
  page,
}) => {
  await openLauncher(page);

  await signUpFromLauncher(page, "Duplicate Hero");
  await signOutFromLauncher(page);

  await page.getByTestId("sign-up-open-button").click();
  await page.getByTestId("auth-displayName-input").fill(" duplicate   hero ");
  await page.getByTestId("auth-password-input").fill("password456");
  await page.getByTestId("auth-passwordConfirmation-input").fill("password456");
  await page.getByTestId("auth-submit-button").click();

  await expect(page.getByTestId("auth-displayName-input")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByText("User name is already taken.")).toBeVisible();

  const expectedConflictIndex = browserIssues.findIndex(
    (issue) =>
      issue.source === "console" &&
      issue.text === "Failed to load resource: the server responded with a status of 409 (Conflict)",
  );

  expect(expectedConflictIndex).toBeGreaterThanOrEqual(0);
  browserIssues.splice(expectedConflictIndex, 1);

  await page.getByRole("button", { name: "Close account dialog" }).click();
  await page.getByTestId("log-in-open-button").click();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByText("Log in to Game Library")).toHaveCount(0);
  await page.getByTestId("auth-displayName-input").fill("Duplicate Hero");
  await page.getByTestId("auth-password-input").fill("password123");
  await page.getByTestId("auth-submit-button").click();
  await expectSignedInProfileMenu(page, "Duplicate Hero");
});

test("auth modal logs registered users back in with a password", async ({ page }) => {
  await openLauncher(page);

  await signUpFromLauncher(page, "Returning Hero");
  await signOutFromLauncher(page);
  await expect(page.getByTestId("log-in-open-button")).toBeVisible();

  await logInFromLauncher(page, "Returning Hero");
});

test("profile access redirects unsigned users into the login modal", async ({ page }) => {
  await page.goto("/profile");

  await expect(page).toHaveURL(/\/\?auth=login$/);
  await expect(page.getByTestId("game-menu")).toBeVisible();
  await expect(page.getByTestId("auth-dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});

test("profile page shows only the current signed-in user", async ({ page }) => {
  await openLauncher(page);
  await signUpFromLauncher(page, "Private Alice");
  await openProfileFromLauncher(page);
  await expect(page.getByRole("heading", { name: "Private Alice" })).toBeVisible();

  await page.getByRole("link", { name: "Back to games" }).click();
  await signOutFromLauncher(page);

  await signUpFromLauncher(page, "Private Bob");
  await openProfileFromLauncher(page);

  await expect(page.getByRole("heading", { name: "Private Bob" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Private Alice" })).toHaveCount(0);
});

test("profile page Escape returns to the game launcher", async ({ page }) => {
  await openLauncher(page);
  await signUpFromLauncher(page, "Profile Escape Hero");
  await openProfileFromLauncher(page);
  await expect(page.getByRole("heading", { name: "Profile Escape Hero" })).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("game-menu")).toBeVisible();
  await expectSignedInProfileMenu(page, "Profile Escape Hero");
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
