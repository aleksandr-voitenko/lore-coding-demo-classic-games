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

export async function selectGameParameter(page: Page, testId: string, value: string) {
  const select = page.getByTestId(testId);

  await expect(select).toBeVisible();
  await select.selectOption(value);
  await expect(select).toHaveValue(value);
}
