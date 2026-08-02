import { expect, test } from "./support/fixtures";
import {
  openLauncher,
  selectGameParameter,
  signOutFromLauncher,
  signUpFromLauncher,
} from "./support/app";

test("private rooms follow browser Back and Forward navigation", async ({ page }) => {
  let roomCreateRequestCount = 0;

  page.on("request", (request) => {
    const url = new URL(request.url());

    if (
      request.method() === "POST" &&
      url.pathname === "/api/multiplayer/rooms/v5"
    ) {
      roomCreateRequestCount += 1;
    }
  });

  await openLauncher(page);
  await signUpFromLauncher(page, "Room History Hero");
  await page.getByTestId("game-library-multiplayer-tab").click();
  await selectGameParameter(page, "pong-target", "7");
  await page.getByTestId("game-card-pong").click();

  await expect(page.getByTestId("multiplayer-room-lobby")).toBeVisible();
  const roomCode = (await page.getByTestId("multiplayer-room-code").innerText()).trim();

  expect(roomCode).toMatch(/^[A-F0-9-]+$/);
  await expect(page).toHaveURL(new RegExp(`\\?room=${roomCode}$`));
  await expect(page.getByTestId("multiplayer-room-current-participant")).toHaveText(
    "Room History Hero · Player · Host",
  );
  expect(roomCreateRequestCount).toBe(1);

  await page.goBack();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("game-menu")).toBeVisible();
  await expect(page.getByTestId("game-library-multiplayer-tab")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByTestId("pong-target")).toHaveValue("7");

  await page.goForward();

  await expect(page).toHaveURL(new RegExp(`\\?room=${roomCode}$`));
  await expect(page.getByTestId("multiplayer-room-lobby")).toBeVisible();
  await expect(page.getByTestId("multiplayer-room-code")).toHaveText(roomCode);
  await expect(page.getByTestId("multiplayer-room-current-participant")).toHaveCount(0);
  await expect(page.getByTestId("multiplayer-room-game")).toHaveCount(0);
  expect(roomCreateRequestCount).toBe(1);
});

test("a delayed stale room response cannot replace a newer create attempt", async ({
  page,
}) => {
  const releaseRoomRequests: (() => void)[] = [];
  let roomResponseCount = 0;

  await page.route("**/api/multiplayer/rooms/v5", async (route) => {
    const request = route.request();

    if (request.method() !== "POST") {
      await route.continue();
      return;
    }

    await new Promise<void>((resolve) => {
      releaseRoomRequests.push(resolve);
    });
    await route.continue();
  });
  page.on("response", (response) => {
    const request = response.request();
    const url = new URL(response.url());

    if (
      request.method() === "POST" &&
      url.pathname === "/api/multiplayer/rooms/v5"
    ) {
      roomResponseCount += 1;
    }
  });

  await openLauncher(page);
  await signUpFromLauncher(page, "Delayed Room Hero");
  await page.getByTestId("game-library-multiplayer-tab").click();
  await page.evaluate(() => {
    window.history.pushState(null, "", "/?createAttempt=first");
  });
  await page.getByTestId("game-card-pong").click();
  await expect.poll(() => releaseRoomRequests.length).toBe(1);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("game-menu")).toBeVisible();

  await page.getByTestId("game-card-pong").click();
  await expect.poll(() => releaseRoomRequests.length).toBe(2);
  await expect(page.getByTestId("multiplayer-room-host-status")).toHaveText(
    "Creating Pong room",
  );

  releaseRoomRequests[0]?.();
  await expect.poll(() => roomResponseCount).toBe(1);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("multiplayer-room-lobby")).toHaveCount(0);
  await expect(page.getByTestId("multiplayer-room-host-status")).toHaveText(
    "Creating Pong room",
  );
  await expect(page.getByTestId("game-card-pong")).toHaveAttribute(
    "aria-busy",
    "true",
  );

  releaseRoomRequests[1]?.();
  await expect.poll(() => roomResponseCount).toBe(2);
  await expect(page.getByTestId("multiplayer-room-lobby")).toBeVisible();
  await expect(page).toHaveURL(/\?room=[A-F0-9-]+$/);
});

test("signed-out Forward mounts without cached room markup", async ({ page }) => {
  await openLauncher(page);
  await signUpFromLauncher(page, "Room Capability Hero");
  await page.getByTestId("game-library-multiplayer-tab").click();
  await page.getByTestId("game-card-pong").click();

  await expect(page.getByTestId("multiplayer-room-lobby")).toBeVisible();
  const roomCode = (await page.getByTestId("multiplayer-room-code").innerText()).trim();

  await page.goBack();
  await expect(page.getByTestId("game-menu")).toBeVisible();
  await signOutFromLauncher(page);
  await page.goForward();

  await expect(page).toHaveURL(new RegExp(`\\?room=${roomCode}$`));
  await expect(page.getByTestId("multiplayer-room-lobby")).toBeVisible();
  await expect(page.getByTestId("multiplayer-room-current-participant")).toHaveCount(0);
});

test("direct room URLs still initialize the room lobby", async ({ page }) => {
  await page.goto("/?room=bad%20code");

  await expect(page).toHaveURL(/\?room=bad%20code$/);
  await expect(page.getByTestId("multiplayer-room-lobby")).toBeVisible();
  await expect(page.getByTestId("multiplayer-room-error")).toHaveText(
    "Room code is not supported.",
  );
  await expect(page.getByTestId("game-menu")).toHaveCount(0);
});
