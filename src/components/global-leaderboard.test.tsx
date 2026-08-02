import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  GAME_CATALOG,
  getGameCatalogArtwork,
  getVersionedGameCatalogArtworkSrc,
} from "@/lib/game-catalog";

import { GlobalLeaderboardScreen } from "./global-leaderboard";

const LEADERBOARD_ARTWORK_SIZES =
  "(min-width: 1280px) 23.333rem, (min-width: 1200px) 35.5rem, (min-width: 768px) calc(50vw - 2rem), (min-width: 640px) calc(100vw - 3rem), calc(100vw - 2rem)";

describe("global leaderboard screen", () => {
  it("renders a leaderboard card for every catalog game", () => {
    const markup = renderToStaticMarkup(
      <GlobalLeaderboardScreen onBackToMenu={vi.fn()} />,
    );

    expect(markup).toContain('data-testid="global-leaderboard-screen"');
    expect(markup).toContain('data-testid="global-leaderboard-back-button"');
    expect(markup).toContain("Leaderboards");

    for (const game of GAME_CATALOG) {
      const artworkSrc = getVersionedGameCatalogArtworkSrc(getGameCatalogArtwork(game.id));

      expect(markup).toContain(`data-testid="global-leaderboard-${game.id}"`);
      expect(markup).toContain(`data-testid="global-leaderboard-${game.id}-slot-1"`);
      expect(getArtworkImageMarkup(markup, artworkSrc)).toHaveLength(2);
      expect(markup).toContain(game.label);
    }

    expect(markup).toContain("Easy difficulty");
    expect(markup).toContain("Loading");
    expect(markup).not.toContain(">SCORE<");
    expect(markup).not.toContain(">TIME<");
  });

  it("renders leaderboard game art with the launcher-style layered frame", () => {
    const markup = renderToStaticMarkup(
      <GlobalLeaderboardScreen onBackToMenu={vi.fn()} />,
    );

    expect(markup).toContain("blur-[2px]");
    expect(markup).toContain("object-contain");
    expect(countOccurrences(markup, `sizes="${LEADERBOARD_ARTWORK_SIZES}"`)).toBe(
      GAME_CATALOG.length,
    );

    for (const game of GAME_CATALOG) {
      const artworkSrc = getVersionedGameCatalogArtworkSrc(getGameCatalogArtwork(game.id));

      expect(getArtworkImageMarkup(markup, artworkSrc)).toHaveLength(2);
    }
  });

  it("renders an injected Friends action in the leaderboard header", () => {
    const defaultMarkup = renderToStaticMarkup(
      <GlobalLeaderboardScreen onBackToMenu={vi.fn()} />,
    );
    const friendsMarkup = renderToStaticMarkup(
      <GlobalLeaderboardScreen
        onBackToMenu={vi.fn()}
        socialCenterTrigger={
          <button data-testid="social-center-trigger" type="button">
            Friends
          </button>
        }
      />,
    );

    expect(defaultMarkup).not.toContain('data-testid="social-center-trigger"');
    expect(friendsMarkup).toContain('data-testid="social-center-trigger"');
  });
});

function getArtworkImageMarkup(markup: string, artworkSrc: string) {
  const encodedArtworkSrc = encodeURIComponent(artworkSrc);

  return (markup.match(/<img\b[^>]*>/g) ?? []).filter((image) =>
    image.includes(encodedArtworkSrc),
  );
}

function countOccurrences(value: string, substring: string) {
  return value.split(substring).length - 1;
}
