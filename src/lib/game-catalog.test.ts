import { describe, expect, it } from "vitest";

import {
  GAME_CATALOG,
  compareGameCatalogOrder,
  formatGameCatalogLabel,
  getGameCatalogArtwork,
  getGameCatalogEntry,
  getVersionedGameCatalogArtworkSrc,
  isGameId,
} from "./game-catalog";

describe("game catalog", () => {
  it("keeps server-safe game ids and labels in launcher order", () => {
    expect(GAME_CATALOG).toEqual([
      { id: "snake", label: "Snake" },
      { id: "tetris", label: "Tetris" },
      { id: "breakout", label: "Breakout" },
      { id: "minesweeper", label: "Minesweeper" },
      { id: "space-invaders", label: "Space Invaders" },
      { id: "twenty-forty-eight", label: "2048" },
      { id: "pong", label: "Pong" },
      { id: "simon", label: "Simon" },
      { id: "asteroids", label: "Asteroids" },
    ]);
  });

  it("formats profile game ids from the shared catalog with a readable fallback", () => {
    expect(formatGameCatalogLabel("space-invaders")).toBe("Space Invaders");
    expect(formatGameCatalogLabel("asteroids")).toBe("Asteroids");
    expect(formatGameCatalogLabel("twenty-forty-eight")).toBe("2048");
    expect(formatGameCatalogLabel("custom-game")).toBe("Custom Game");
  });

  it("looks up catalog entries only for known playable games", () => {
    expect(isGameId("snake")).toBe(true);
    expect(isGameId("custom-game")).toBe(false);
    expect(isGameId("toString")).toBe(false);
    expect(getGameCatalogEntry("snake")).toEqual({ id: "snake", label: "Snake" });
  });

  it("shares launcher card artwork for server-rendered profile previews", () => {
    const artwork = getGameCatalogArtwork("snake");

    expect(artwork).toEqual({
      height: 941,
      src: "/images/snake-game-card.png",
      width: 1672,
    });
    expect(getVersionedGameCatalogArtworkSrc(artwork)).toBe(
      "/images/snake-game-card.png?v=ai-key-art-v2",
    );
    expect(getGameCatalogArtwork("custom-game")).toBeNull();
  });

  it("sorts persisted profile game ids in launcher menu order", () => {
    expect(
      ["custom-game", "asteroids", "snake", "pong", "breakout", "unknown-game"].sort(
        compareGameCatalogOrder,
      ),
    ).toEqual(["snake", "breakout", "pong", "asteroids", "custom-game", "unknown-game"]);
  });
});
