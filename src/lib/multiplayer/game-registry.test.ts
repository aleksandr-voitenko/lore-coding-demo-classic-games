import { describe, expect, it } from "vitest";

import { GAME_CATALOG, getGameCatalogEntry } from "../game-catalog";
import {
  DEFAULT_MULTIPLAYER_GAME_ID,
  MULTIPLAYER_GAME_IDS,
  isMultiplayerGameId,
} from "./game-registry";

describe("multiplayer game registry", () => {
  it("keeps supported game ids in registry order and aligned with catalog labels", () => {
    expect(MULTIPLAYER_GAME_IDS).toEqual([
      "space-invaders",
      "pong",
      "asteroids",
    ]);
    expect(MULTIPLAYER_GAME_IDS.map(getGameCatalogEntry)).toEqual([
      { id: "space-invaders", label: "Space Invaders" },
      { id: "pong", label: "Pong" },
      { id: "asteroids", label: "Asteroids" },
    ]);
    expect(DEFAULT_MULTIPLAYER_GAME_ID).toBe("pong");
  });

  it("recognizes exactly the catalog games registered for multiplayer", () => {
    expect(
      GAME_CATALOG.filter((game) => isMultiplayerGameId(game.id)).map(
        (game) => game.id,
      ),
    ).toEqual(MULTIPLAYER_GAME_IDS);
    expect(isMultiplayerGameId("snake")).toBe(false);
    expect(isMultiplayerGameId("unknown-game")).toBe(false);
    expect(isMultiplayerGameId("toString")).toBe(false);
  });
});
