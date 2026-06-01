import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import {
  logInFromLauncher,
  openGame,
  openLauncher,
  selectGameParameter,
  signUpFromLauncher,
} from "./support/app";

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

const launcherParameterHandoffCases: LauncherParameterHandoffCase[] = [
  {
    assertGameSeeded: async (page) => {
      await expect(page.getByTestId("snake-status")).toHaveText("Ready");
      await expect(page.getByTestId("snake-board")).toHaveAttribute(
        "aria-label",
        /Snake board\. Field 25 by 25\. Score 0\. Ready\./,
      );
    },
    gameId: "snake",
    name: "Snake board size",
    parameters: [{ testId: "snake-board-size", value: "25" }],
  },
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
      await expect(page.getByTestId("space-invaders-remaining")).toHaveText("24");
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
      await expect(page.getByTestId("asteroids-rocks")).toHaveText("8");
      await expect(page.getByTestId("asteroids-board")).toHaveAttribute(
        "aria-label",
        /Asteroids board\. Field 800 by 600\. Score 0\. Lives 3\. Wave 1\. 8 asteroids remaining\. Ready\./,
      );
    },
    gameId: "asteroids",
    name: "Asteroids board and rock count",
    parameters: [
      { testId: "asteroids-board-size", value: "800x600" },
      { testId: "asteroids-rocks", value: "8" },
    ],
  },
];

test("launcher renders game cards and configurable parameters", async ({ page }) => {
  await openLauncher(page);

  for (const gameId of gameCardIds) {
    await expect(page.getByTestId(`game-card-${gameId}`)).toBeVisible();
  }

  await expect(page.getByText("9 games available")).toBeVisible();
  await expect(page.getByTestId("snake-board-size")).toHaveValue("19");
  await expect(page.getByTestId("tetris-board-size")).toHaveValue("10x20");
  await expect(page.getByTestId("tetris-start-level")).toHaveValue("1");
  await expect(page.getByTestId("minesweeper-mines")).toHaveValue("10");
  await expect(page.getByTestId("asteroids-rocks")).toHaveValue("6");
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

  await page.getByTestId("profile-link").click();
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
  await expect(page.getByTestId("profile-link")).toContainText("E2E Hero");
  await expect(page.getByTestId("auth-displayName-input")).toHaveCount(0);
});

test("launcher renders signed-in account controls as separate buttons", async ({ page }) => {
  await openLauncher(page);

  await signUpFromLauncher(page, "Separate Button Hero");

  const accountActionMetrics = await page.getByTestId("user-account-controls").evaluate((element) => {
    const profileLink = element.querySelector('[data-testid="profile-link"]');
    const signOutButton = element.querySelector('[data-testid="sign-out-button"]');

    if (!(profileLink instanceof HTMLElement) || !(signOutButton instanceof HTMLElement)) {
      throw new Error("Signed-in account controls did not render both actions.");
    }

    const profileLinkRect = profileLink.getBoundingClientRect();
    const signOutButtonRect = signOutButton.getBoundingClientRect();
    const profileLinkStyle = getComputedStyle(profileLink);
    const signOutButtonStyle = getComputedStyle(signOutButton);

    return {
      containerBackground: getComputedStyle(element).backgroundColor,
      gap: signOutButtonRect.left - profileLinkRect.right,
      profileLinkBorderWidth: profileLinkStyle.borderLeftWidth,
      signOutButtonBorderWidth: signOutButtonStyle.borderLeftWidth,
    };
  });

  expect(accountActionMetrics.containerBackground).toBe("rgba(0, 0, 0, 0)");
  expect(accountActionMetrics.gap).toBeGreaterThanOrEqual(7);
  expect(accountActionMetrics.profileLinkBorderWidth).toBe("1px");
  expect(accountActionMetrics.signOutButtonBorderWidth).toBe("1px");
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
  await page.getByTestId("sign-out-button").click();
  await expect(page.getByTestId("sign-up-open-button")).toBeVisible();

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
  await expect(page.getByTestId("profile-link")).toContainText("Duplicate Hero");
});

test("auth modal logs registered users back in with a password", async ({ page }) => {
  await openLauncher(page);

  await signUpFromLauncher(page, "Returning Hero");
  await page.getByTestId("sign-out-button").click();
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
  await page.getByTestId("profile-link").click();
  await expect(page.getByRole("heading", { name: "Private Alice" })).toBeVisible();

  await page.getByRole("link", { name: "Back to games" }).click();
  await page.getByTestId("sign-out-button").click();
  await expect(page.getByTestId("sign-up-open-button")).toBeVisible();

  await signUpFromLauncher(page, "Private Bob");
  await page.getByTestId("profile-link").click();

  await expect(page.getByRole("heading", { name: "Private Bob" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Private Alice" })).toHaveCount(0);
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
