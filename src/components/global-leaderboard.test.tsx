import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  GAME_CATALOG,
  getGameCatalogArtwork,
  getVersionedGameCatalogArtworkSrc,
} from "@/lib/game-catalog";

import { GlobalLeaderboardScreen } from "./global-leaderboard";

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
      expect(markup).toContain(artworkSrc);
      expect(markup).toContain(game.label);
    }

    expect(markup).toContain("Easy difficulty");
    expect(markup).toContain("Loading");
    expect(markup).not.toContain(">SCORE<");
    expect(markup).not.toContain(">TIME<");
  });
});
