import type { Locator } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { openLauncher } from "./support/app";

const EXPECTED_CARD_LABELS = [
  "Play Snake",
  "Play Tetris",
  "Play Breakout",
  "Play Minesweeper",
  "Play Space Invaders",
  "Play 2048",
  "Play Pong",
  "Play Simon",
  "Play Asteroids",
];
const GAME_CARD_SOURCE_PATTERN =
  /^\/images\/[a-z0-9-]+-game-card\.png\?v=ai-key-art-v2$/;
const MAX_LAUNCHER_ARTWORK_BYTES = 250_000;
const MAX_RETINA_LIBRARY_ARTWORK_BYTES = 1_000_000;
const NEXT_IMAGE_WIDTHS = [
  32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840,
];

test("launcher loads responsive optimized key art without changing card behavior", async ({
  page,
}) => {
  const responseTasks: Promise<void>[] = [];
  const responses = new Map<
    string,
    { bytes: number; contentType: string | undefined; source: string; status: number }
  >();

  page.on("response", (response) => {
    const responseURL = new URL(response.url());
    const source = responseURL.searchParams.get("url");

    if (responseURL.pathname !== "/_next/image" || !source?.match(GAME_CARD_SOURCE_PATTERN)) {
      return;
    }

    responseTasks.push(
      response.body().then((body) => {
        responses.set(response.url(), {
          bytes: body.byteLength,
          contentType: response.headers()["content-type"],
          source,
          status: response.status(),
        });
      }),
    );
  });

  await openLauncher(page);

  const cards = page.locator('[data-testid^="game-card-"]');
  const images = cards.locator("img");

  await expect(cards).toHaveCount(9);
  expect(
    await cards.evaluateAll((elements) =>
      elements.map((card) => card.getAttribute("aria-label")),
    ),
  ).toEqual(EXPECTED_CARD_LABELS);
  await expect(images).toHaveCount(18);

  for (let index = 0; index < (await cards.count()); index += 1) {
    await cards.nth(index).scrollIntoViewIfNeeded();
  }

  await expect
    .poll(() =>
      images.evaluateAll((elements) =>
        elements.every(
          (image) => image instanceof HTMLImageElement && image.complete,
        ),
      ),
    )
    .toBe(true);

  const imageStates = await images.evaluateAll((elements) =>
    elements.map((image) => {
      if (!(image instanceof HTMLImageElement)) {
        throw new Error("Expected launcher artwork to render with img elements.");
      }

      const currentURL = new URL(image.currentSrc);

      return {
        alt: image.getAttribute("alt"),
        ariaHidden: image.getAttribute("aria-hidden"),
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
        objectFit: getComputedStyle(image).objectFit,
        optimizerPath: currentURL.pathname,
        sizes: image.getAttribute("sizes"),
        source: currentURL.searchParams.get("url"),
      };
    }),
  );

  expect(imageStates.filter((image) => image.objectFit === "cover")).toHaveLength(9);
  expect(imageStates.filter((image) => image.objectFit === "contain")).toHaveLength(9);

  for (const image of imageStates) {
    expect(image.alt).toBe("");
    expect(image.ariaHidden).toBe("true");
    expect(image.optimizerPath).toBe("/_next/image");
    expect(image.source).toMatch(GAME_CARD_SOURCE_PATTERN);
    expect(image.sizes).not.toBeNull();
    expect(image.naturalWidth).toBeGreaterThan(0);
    expect(image.naturalWidth).toBeLessThanOrEqual(384);
    expect(image.naturalHeight).toBeLessThanOrEqual(216);
  }

  await Promise.all(responseTasks);

  await page.getByTestId("global-leaderboard-open-button").click();

  const leaderboardCards = page.locator(
    'article[data-testid^="global-leaderboard-"]',
  );
  const leaderboardImages = leaderboardCards.locator("img");

  await expect(page.getByTestId("global-leaderboard-screen")).toBeVisible();
  await expect(leaderboardCards).toHaveCount(9);
  await expect(leaderboardImages).toHaveCount(18);

  for (let index = 0; index < (await leaderboardCards.count()); index += 1) {
    await leaderboardCards.nth(index).scrollIntoViewIfNeeded();
  }

  await expect
    .poll(() =>
      leaderboardImages.evaluateAll((elements) =>
        elements.every(
          (image) =>
            image instanceof HTMLImageElement &&
            image.complete &&
            new URL(image.currentSrc).pathname === "/_next/image",
        ),
      ),
    )
    .toBe(true);

  await Promise.all(responseTasks);

  expect(new Set([...responses.values()].map((response) => response.source)).size).toBe(9);
  expect([...responses.values()].every((response) => response.status === 200)).toBe(true);
  expect(
    [...responses.values()].every((response) => response.contentType === "image/webp"),
  ).toBe(true);
  expect(
    [...responses.values()].reduce((total, response) => total + response.bytes, 0),
  ).toBeLessThan(MAX_LAUNCHER_ARTWORK_BYTES);

  expect(
    await leaderboardCards.evaluateAll((elements) =>
      elements.map((card) => card.firstElementChild?.getBoundingClientRect().height),
    ),
  ).toEqual(Array.from({ length: 9 }, () => 160));

  await page.getByTestId("global-leaderboard-back-button").click();
  await expect(page.getByTestId("game-menu")).toBeVisible();
  await page.getByRole("button", { name: "Play Snake" }).click();
  await expect(page.getByTestId("snake-status")).toHaveText("Ready");
});

test.describe("retina artwork selection", () => {
  test.use({ deviceScaleFactor: 2, viewport: { height: 900, width: 1279 } });

  test("chooses the smallest sufficient source for launcher and leaderboard cards", async ({
    page,
  }) => {
    const responseTasks: Promise<void>[] = [];
    const responses = new Map<
      string,
      { bytes: number; contentType: string | undefined; source: string; status: number }
    >();

    page.on("response", (response) => {
      const responseURL = new URL(response.url());
      const source = responseURL.searchParams.get("url");

      if (
        responseURL.pathname !== "/_next/image" ||
        !source?.match(GAME_CARD_SOURCE_PATTERN)
      ) {
        return;
      }

      responseTasks.push(
        response.body().then((body) => {
          responses.set(response.url(), {
            bytes: body.byteLength,
            contentType: response.headers()["content-type"],
            source,
            status: response.status(),
          });
        }),
      );
    });

    await openLauncher(page);

    const launcherCards = page.locator('[data-testid^="game-card-"]');

    await scrollThroughCards(launcherCards);
    await expectSmallestSufficientBackgroundArtwork(
      launcherCards.locator("img.object-cover"),
      2,
    );

    await page.getByTestId("global-leaderboard-open-button").click();

    const leaderboardCards = page.locator(
      'article[data-testid^="global-leaderboard-"]',
    );

    await expect(page.getByTestId("global-leaderboard-screen")).toBeVisible();
    await scrollThroughCards(leaderboardCards);
    await expectSmallestSufficientBackgroundArtwork(
      leaderboardCards.locator("img.object-cover"),
      2,
    );
    await Promise.all(responseTasks);

    const responseValues = [...responses.values()];
    const responseWidths = [
      ...new Set(
        [...responses.keys()].map((url) => Number(new URL(url).searchParams.get("w"))),
      ),
    ].sort((left, right) => left - right);

    expect(new Set(responseValues.map((response) => response.source)).size).toBe(9);
    expect(responseWidths).toEqual([640, 750, 1200]);
    expect(responseValues.every((response) => response.status === 200)).toBe(true);
    expect(responseValues.every((response) => response.contentType === "image/webp")).toBe(
      true,
    );
    expect(responseValues.reduce((total, response) => total + response.bytes, 0)).toBeLessThan(
      MAX_RETINA_LIBRARY_ARTWORK_BYTES,
    );
  });
});

async function scrollThroughCards(cards: Locator) {
  for (let index = 0; index < (await cards.count()); index += 1) {
    await cards.nth(index).scrollIntoViewIfNeeded();
  }
}

async function expectSmallestSufficientBackgroundArtwork(
  images: Locator,
  devicePixelRatio: number,
) {
  await expect(images).toHaveCount(9);
  await expect
    .poll(() =>
      images.evaluateAll((elements) =>
        elements.every(
          (image) => image instanceof HTMLImageElement && image.complete,
        ),
      ),
    )
    .toBe(true);

  const selections = await images.evaluateAll((elements) =>
    elements.map((image) => {
      if (!(image instanceof HTMLImageElement)) {
        throw new Error("Expected card artwork to render with img elements.");
      }

      return {
        clientWidth: image.clientWidth,
        objectFit: getComputedStyle(image).objectFit,
        selectedWidth: Number(new URL(image.currentSrc).searchParams.get("w")),
        source: new URL(image.currentSrc).searchParams.get("url"),
      };
    }),
  );

  const mismatches = selections.flatMap((selection) => {
    const requiredWidth = selection.clientWidth * devicePixelRatio;
    const expectedWidth =
      NEXT_IMAGE_WIDTHS.find((width) => width >= requiredWidth) ??
      NEXT_IMAGE_WIDTHS.at(-1);

    return selection.selectedWidth === expectedWidth
      ? []
      : [{ ...selection, expectedWidth, requiredWidth }];
  });

  expect(mismatches).toEqual([]);
}
