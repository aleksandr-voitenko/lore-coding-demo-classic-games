import { describe, expect, it } from "vitest";

import { GAME_CATALOG } from "../game-catalog";
import {
  DEFAULT_MULTIPLAYER_GAME_ID,
  MULTIPLAYER_GAME_IDS,
  isMultiplayerGameId,
} from "../multiplayer/game-registry";
import {
  getDefaultMultiplayerServerGameAdapter,
  getMultiplayerServerGameAdapter,
} from "./multiplayer-game-adapters";

describe("multiplayer server game adapter registry", () => {
  it("has one matching adapter for every supported multiplayer game", () => {
    for (const gameId of MULTIPLAYER_GAME_IDS) {
      const adapter = getMultiplayerServerGameAdapter(gameId);

      expect(adapter?.gameId).toBe(gameId);
      expect(adapter?.defaultSettings.gameId).toBe(gameId);
    }
  });

  it("derives its default and rejects catalog games without adapters", () => {
    expect(getDefaultMultiplayerServerGameAdapter().gameId).toBe(
      DEFAULT_MULTIPLAYER_GAME_ID,
    );

    for (const game of GAME_CATALOG) {
      if (!isMultiplayerGameId(game.id)) {
        expect(getMultiplayerServerGameAdapter(game.id)).toBeNull();
      }
    }
  });
});
