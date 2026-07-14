import { describe, expect, it } from "vitest";

import { GAME_CATALOG } from "../game-catalog";
import {
  DEFAULT_MULTIPLAYER_GAME_ID,
  MULTIPLAYER_GAME_IDS,
  isMultiplayerGameId,
} from "../multiplayer/game-registry";
import type { PrivateRoom } from "../multiplayer/room";
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

  it("classifies only each adapter's actual game-over states as terminal", () => {
    const room = {
      code: "ROOM1",
      hostParticipantId: "host-1",
      participants: [
        {
          displayName: "Ada Host",
          id: "host-1",
          role: "host",
          userId: "user-1",
        },
      ],
      seats: [],
      settings: { gameId: "pong" },
      status: "running",
    } satisfies PrivateRoom;
    const cases = [
      {
        gameId: "pong" as const,
        nonterminalStatuses: ["ready", "running", "paused"],
        terminalStatuses: ["won", "lost"],
      },
      {
        gameId: "space-invaders" as const,
        nonterminalStatuses: ["ready", "running", "paused"],
        terminalStatuses: ["won", "lost"],
      },
      {
        gameId: "asteroids" as const,
        nonterminalStatuses: ["ready", "running", "paused"],
        terminalStatuses: ["lost"],
      },
      {
        gameId: "battle-city" as const,
        nonterminalStatuses: [
          "ready",
          "stage-intro",
          "running",
          "paused",
          "stage-clear",
          "game-over",
          "stage-results",
        ],
        terminalStatuses: ["lost"],
      },
    ];

    for (const { gameId, nonterminalStatuses, terminalStatuses } of cases) {
      const adapter = getMultiplayerServerGameAdapter(gameId);

      if (adapter === null) {
        throw new Error(`Expected a ${gameId} multiplayer adapter.`);
      }

      for (const status of nonterminalStatuses) {
        expect(
          adapter.isTerminal({
            room: {
              ...room,
              settings: { gameId },
            },
            runtime: { game: { status } },
          }),
        ).toBe(false);
      }

      for (const status of terminalStatuses) {
        expect(
          adapter.isTerminal({
            room: {
              ...room,
              settings: { gameId },
            },
            runtime: { game: { status } },
          }),
        ).toBe(true);
      }
    }
  });
});
