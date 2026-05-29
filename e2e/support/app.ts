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
  await expect(page.getByTestId("profile-link")).toContainText(displayName);
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
  await expect(page.getByTestId("profile-link")).toContainText(displayName);
}

export async function selectGameParameter(page: Page, testId: string, value: string) {
  const select = page.getByTestId(testId);

  await expect(select).toBeVisible();
  await select.selectOption(value);
  await expect(select).toHaveValue(value);
}
