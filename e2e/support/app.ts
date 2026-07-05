import { expect, type Page } from "@playwright/test";

export async function openLauncher(page: Page) {
  await page.goto("/");

  await expect(page).toHaveTitle("Game Library");
  await expect(page.getByTestId("game-menu")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Game Library" })).toBeVisible();
}

export async function openGame(page: Page, gameId: string) {
  await page.getByTestId(`game-card-${gameId}`).click();
}

export async function hostMultiplayerRoomFromLauncher(page: Page, gameId: string) {
  await page.getByTestId("game-library-multiplayer-tab").click();
  await expect(page.getByTestId("game-library-multiplayer-tab")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByTestId(`game-card-${gameId}`).click();
}

export async function expectSignedInProfileMenu(page: Page, displayName: string) {
  const profileMenuTrigger = page.getByTestId("profile-menu-trigger");

  await expect(profileMenuTrigger).toBeVisible();
  await expect(profileMenuTrigger).toHaveAccessibleName(`${displayName} account menu`);
}

export async function openProfileMenu(page: Page) {
  await page.getByTestId("profile-menu-trigger").click();
  await expect(page.getByTestId("profile-menu")).toBeVisible();
}

export async function openProfileFromLauncher(page: Page) {
  await openProfileMenu(page);
  await page.getByTestId("profile-link").click();
}

export async function signOutFromLauncher(page: Page) {
  await openProfileMenu(page);
  await page.getByTestId("sign-out-button").click();
  await expect(page.getByTestId("sign-up-open-button")).toBeVisible();
}

export async function logInFromLauncher(
  page: Page,
  displayName: string,
  password = "password123",
) {
  await page.getByTestId("log-in-open-button").click();
  await expect(page.getByTestId("auth-dialog")).toBeVisible();
  await page.getByTestId("auth-displayName-input").fill(displayName);
  await page.getByTestId("auth-password-input").fill(password);
  await page.getByTestId("auth-submit-button").click();
  await expectSignedInProfileMenu(page, displayName);
}

export async function signUpFromLauncher(
  page: Page,
  displayName: string,
  password = "password123",
) {
  await page.getByTestId("sign-up-open-button").click();
  await expect(page.getByTestId("auth-dialog")).toBeVisible();
  await page.getByTestId("auth-displayName-input").fill(displayName);
  await page.getByTestId("auth-password-input").fill(password);
  await page.getByTestId("auth-passwordConfirmation-input").fill(password);
  await page.getByTestId("auth-submit-button").click();
  await expectSignedInProfileMenu(page, displayName);
}

export async function selectGameParameter(page: Page, testId: string, value: string) {
  const select = page.getByTestId(testId);

  await expect(select).toBeVisible();
  await select.selectOption(value);
  await expect(select).toHaveValue(value);
}
