import { describe, expect, it } from "vitest";

import type { MultiplayerTerminalSummary } from "../multiplayer/protocol";
import type { PrivateRoom } from "../multiplayer/room";
import { asteroidsMultiplayerRuntimeAdapter } from "./asteroids-multiplayer-game-adapter";
import { battleCityMultiplayerRuntimeAdapter } from "./battle-city-multiplayer-game-adapter";
import type { MultiplayerServerGameRuntimeAdapter } from "./multiplayer-game-adapter-contract";
import { pongMultiplayerRuntimeAdapter } from "./pong-multiplayer-game-adapter";
import { spaceInvadersMultiplayerRuntimeAdapter } from "./space-invaders-multiplayer-game-adapter";

const TERMINAL_CASES = [
  {
    adapter: pongMultiplayerRuntimeAdapter,
    gameId: "pong",
    terminalStatus: "won",
  },
  {
    adapter: spaceInvadersMultiplayerRuntimeAdapter,
    gameId: "space-invaders",
    terminalStatus: "lost",
  },
  {
    adapter: asteroidsMultiplayerRuntimeAdapter,
    gameId: "asteroids",
    terminalStatus: "lost",
  },
  {
    adapter: battleCityMultiplayerRuntimeAdapter,
    gameId: "battle-city",
    terminalStatus: "lost",
  },
] as const;

function createMatchRoom(
  adapter: MultiplayerServerGameRuntimeAdapter,
): PrivateRoom {
  return {
    code: "ROOM1",
    hostParticipantId: "host-1",
    matchId: 1,
    nextMatchParticipantIds: [],
    observerLimit: 8,
    participants: [
      {
        displayName: "Ada Host",
        id: "host-1",
        role: "host",
        userId: "user-1",
      },
      {
        displayName: "Grace Guest",
        id: "guest-1",
        role: "player",
        userId: null,
      },
    ],
    seats: adapter.defaultSeats.map((seat, index) => ({
      id: String(seat.id),
      label: String(seat.label),
      occupiedByParticipantId: index === 0 ? "host-1" : "guest-1",
      required: true,
    })),
    settings: adapter.defaultSettings,
    status: "running",
  };
}

function createChangedLiveRoom(matchRoom: PrivateRoom): PrivateRoom {
  return {
    ...matchRoom,
    participants: matchRoom.participants.filter(
      (participant) => participant.id !== "guest-1",
    ),
    seats: matchRoom.seats.map((seat, index) =>
      index === 1
        ? {
            ...seat,
            occupiedByParticipantId: null,
          }
        : seat,
    ),
    settings: {
      gameId: matchRoom.settings.gameId,
      parameters: {
        attribution: "changed-live-room",
      },
    },
  };
}

function setRuntimeTerminalStatus(runtime: unknown, status: "lost" | "won") {
  const storedRuntime = runtime as {
    game: Record<string, unknown>;
  };

  storedRuntime.game = {
    ...storedRuntime.game,
    status,
  };
}

function getTerminalSummary(snapshot: unknown) {
  return (snapshot as { summary?: MultiplayerTerminalSummary }).summary;
}

describe("multiplayer adapter terminal attribution", () => {
  it.each(TERMINAL_CASES)(
    "uses the immutable $gameId match room for terminal attribution",
    ({ adapter, terminalStatus }) => {
      const matchRoom = createMatchRoom(adapter);
      const runtimeResult = adapter.createRuntime({
        nowMs: 1_000,
        room: matchRoom,
      });

      expect(runtimeResult.success).toBe(true);

      if (!runtimeResult.success) {
        throw new Error(runtimeResult.error);
      }

      setRuntimeTerminalStatus(runtimeResult.runtime, terminalStatus);
      const liveRoom = createChangedLiveRoom(matchRoom);
      const snapshot = adapter.createSnapshot({
        matchRoom,
        room: liveRoom,
        runtime: runtimeResult.runtime,
        serverTimeMs: 1_500,
      });
      const summary = getTerminalSummary(snapshot);

      expect(summary).toBeDefined();
      expect(summary?.settings).toEqual(matchRoom.settings);
      expect(summary?.settings).not.toEqual(liveRoom.settings);
      expect(summary?.seats).toEqual([
        {
          id: matchRoom.seats[0].id,
          label: matchRoom.seats[0].label,
          participant: matchRoom.participants[0],
        },
        {
          id: matchRoom.seats[1].id,
          label: matchRoom.seats[1].label,
          participant: matchRoom.participants[1],
        },
      ]);
    },
  );
});
