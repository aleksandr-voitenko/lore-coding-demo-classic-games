import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CurrentUserProvider } from "@/hooks/use-current-user";
import { MULTIPLAYER_GAME_IDS } from "@/lib/multiplayer/game-registry";
import type { PrivateRoom } from "@/lib/multiplayer/room";
import type { MultiplayerRoomGameSnapshot } from "@/lib/multiplayer/protocol";
import {
  createInitialPongGame,
  startPongGame,
} from "@/lib/pong-game-engine";
import type { PongMultiplayerGameSnapshot } from "@/lib/pong-multiplayer";

import { getMultiplayerRoomGameRenderer } from "./multiplayer-room-game-registry";
import {
  MultiplayerRoomLobby,
  getMultiplayerRoomConnectionErrorState,
  getPrivateRoomShareLink,
  selectFreshMultiplayerRoomSnapshot,
} from "./multiplayer-room-lobby";
import { MultiplayerRoomTransportError } from "./multiplayer-room-transport";

const PONG_ROOM: PrivateRoom = {
  code: "PONG-1",
  hostParticipantId: "host-participant",
  participants: [
    {
      displayName: "Ada",
      id: "host-participant",
      role: "host",
      userId: "user-1",
    },
    {
      displayName: "Grace",
      id: "guest-participant",
      role: "observer",
      userId: null,
    },
  ],
  seats: [
    {
      id: "left",
      label: "Left Paddle",
      occupiedByParticipantId: "host-participant",
      required: true,
    },
    {
      id: "right",
      label: "Right Paddle",
      occupiedByParticipantId: null,
      required: true,
    },
  ],
  settings: {
    gameId: "pong",
    parameters: {
      "pong-board-size": "420x560",
      "pong-target": "5",
    },
  },
  status: "lobby",
};

const ACTIVE_PONG_ROOM: PrivateRoom = {
  ...PONG_ROOM,
  participants: PONG_ROOM.participants.map((participant) =>
    participant.id === "guest-participant"
      ? {
          ...participant,
          role: "player",
        }
      : participant,
  ),
  seats: PONG_ROOM.seats.map((seat) =>
    seat.id === "right"
      ? {
          ...seat,
          occupiedByParticipantId: "guest-participant",
        }
      : seat,
  ),
  status: "running",
};

const ACTIVE_SNAKE_ROOM: PrivateRoom = {
  ...ACTIVE_PONG_ROOM,
  settings: {
    gameId: "snake",
  },
};

const RUNNING_PONG_GAME = {
  gameId: "pong",
  heldInputs: {},
  seq: 1,
  serverTimeMs: 1_000,
  snapshot: startPongGame(createInitialPongGame()),
} satisfies PongMultiplayerGameSnapshot;

const RUNNING_SNAKE_GAME = {
  gameId: "snake",
  seq: 1,
  serverTimeMs: 1_000,
  snapshot: {},
} satisfies MultiplayerRoomGameSnapshot<"snake", Record<string, never>>;

describe("multiplayer room lobby", () => {
  it("renders loaded room details, seats, participants, and host controls", () => {
    const markup = renderToStaticMarkup(
      <CurrentUserProvider initialUser={{ displayName: "Ada", id: "user-1" }}>
        <MultiplayerRoomLobby
          initialParticipantId="host-participant"
          initialRoom={PONG_ROOM}
          initialRoomCode="PONG-1"
          onBackToLibrary={vi.fn()}
        />
      </CurrentUserProvider>,
    );

    expect(markup).toContain('data-testid="multiplayer-room-lobby"');
    expect(markup).toContain('data-testid="multiplayer-room-game"');
    expect(markup).toContain("Pong");
    expect(markup).toContain('data-testid="multiplayer-room-status"');
    expect(markup).toContain("Lobby");
    expect(markup).toContain("/?room=PONG-1");
    expect(markup).toContain("420 x 560");
    expect(markup).toContain('data-testid="multiplayer-room-seat-left"');
    expect(markup).toContain('data-testid="multiplayer-room-release-seat-left"');
    expect(markup).toContain('data-testid="multiplayer-room-claim-seat-right"');
    expect(markup).toContain('data-testid="multiplayer-room-participant-host-participant"');
    expect(markup).toContain('data-testid="multiplayer-room-host-controls"');
    expect(markup).toContain('data-testid="multiplayer-room-start-button"');
  });

  it("uses the requested room code for invite copy even before matching room data arrives", () => {
    const staleRoom = {
      ...PONG_ROOM,
      code: "OLDROOM1",
    };
    const markup = renderToStaticMarkup(
      <CurrentUserProvider initialUser={{ displayName: "Ada", id: "user-1" }}>
        <MultiplayerRoomLobby
          initialParticipantId="host-participant"
          initialRoom={staleRoom}
          initialRoomCode="44FE068B"
          onBackToLibrary={vi.fn()}
        />
      </CurrentUserProvider>,
    );

    expect(markup).toContain("/?room=44FE068B");
    expect(markup).not.toContain("/?room=OLDROOM1");
  });

  it("renders the guest display-name join form before the visitor has a participant", () => {
    const markup = renderToStaticMarkup(
      <MultiplayerRoomLobby
        initialRoom={PONG_ROOM}
        initialRoomCode="PONG-1"
        onBackToLibrary={vi.fn()}
      />,
    );

    expect(markup).toContain('data-testid="multiplayer-room-join-form"');
    expect(markup).toContain('data-testid="multiplayer-room-display-name-input"');
    expect(markup).toContain('data-testid="multiplayer-room-join-button"');
    expect(markup).toContain('data-testid="multiplayer-room-claim-seat-right"');
    expect(markup).not.toContain('data-testid="multiplayer-room-host-controls"');
  });

  it("keeps lobby UI for lobby rooms even when no game snapshot exists", () => {
    const markup = renderToStaticMarkup(
      <MultiplayerRoomLobby
        initialParticipantId="host-participant"
        initialRoom={PONG_ROOM}
        initialRoomCode="PONG-1"
        onBackToLibrary={vi.fn()}
      />,
    );

    expect(markup).toContain('data-testid="multiplayer-room-seats"');
    expect(markup).not.toContain('data-testid="pong-multiplayer-room"');
  });

  it("renders active Pong rooms through the multiplayer Pong surface", () => {
    const markup = renderToStaticMarkup(
      <CurrentUserProvider initialUser={{ displayName: "Ada", id: "user-1" }}>
        <MultiplayerRoomLobby
          initialGame={RUNNING_PONG_GAME}
          initialParticipantId="host-participant"
          initialRoom={ACTIVE_PONG_ROOM}
          initialRoomCode="PONG-1"
          initialSeq={4}
          onBackToLibrary={vi.fn()}
        />
      </CurrentUserProvider>,
    );

    expect(markup).toContain('data-testid="pong-multiplayer-room"');
    expect(markup).toContain('data-testid="pong-board"');
    expect(markup).toContain('data-testid="pong-multiplayer-score-left"');
    expect(markup).toContain("Ada · Left Paddle");
    expect(markup).toContain('data-testid="multiplayer-room-host-controls"');
    expect(markup).not.toContain('data-testid="multiplayer-room-seats"');
  });

  it("selects registered active game renderers only when room and snapshot game ids match", () => {
    for (const gameId of MULTIPLAYER_GAME_IDS) {
      const room = {
        ...ACTIVE_PONG_ROOM,
        settings: { gameId },
      } satisfies PrivateRoom;
      const game = {
        gameId,
        seq: 1,
        serverTimeMs: 1_000,
        snapshot: {},
      } satisfies MultiplayerRoomGameSnapshot;

      expect(getMultiplayerRoomGameRenderer(room, game)?.gameId).toBe(gameId);
    }

    expect(getMultiplayerRoomGameRenderer(ACTIVE_PONG_ROOM, null)).toBeNull();
    expect(
      getMultiplayerRoomGameRenderer(ACTIVE_PONG_ROOM, RUNNING_SNAKE_GAME),
    ).toBeNull();
    expect(
      getMultiplayerRoomGameRenderer(ACTIVE_SNAKE_ROOM, RUNNING_SNAKE_GAME),
    ).toBeNull();
  });

  it("keeps the generic room shell for active rooms without a registered renderer", () => {
    const markup = renderToStaticMarkup(
      <CurrentUserProvider initialUser={{ displayName: "Ada", id: "user-1" }}>
        <MultiplayerRoomLobby
          initialGame={RUNNING_SNAKE_GAME}
          initialParticipantId="host-participant"
          initialRoom={ACTIVE_SNAKE_ROOM}
          initialRoomCode="PONG-1"
          initialSeq={4}
          onBackToLibrary={vi.fn()}
        />
      </CurrentUserProvider>,
    );

    expect(markup).toContain('data-testid="multiplayer-room-game"');
    expect(markup).toContain("Snake");
    expect(markup).toContain('data-testid="multiplayer-room-seats"');
    expect(markup).not.toContain('data-testid="pong-multiplayer-room"');
  });

  it("marks missing rooms as abandoned after unrecoverable stream bootstrap rejection", () => {
    expect(
      getMultiplayerRoomConnectionErrorState(
        new MultiplayerRoomTransportError("Room was not found.", {
          code: "room-not-found",
        }),
      ),
    ).toEqual({
      abandonRoom: true,
      message:
        "Room connection lost. This room is no longer available, so the in-progress game cannot continue. Start or join a new room.",
    });

    expect(
      getMultiplayerRoomConnectionErrorState(
        new MultiplayerRoomTransportError("Room stream connection failed."),
      ),
    ).toEqual({
      abandonRoom: false,
      message: "Room stream connection failed.",
    });
  });

  it("builds full private-room share links when a browser origin is available", () => {
    expect(getPrivateRoomShareLink("44fe068b", "http://localhost:3000")).toBe(
      "http://localhost:3000/?room=44FE068B",
    );
    expect(getPrivateRoomShareLink("44FE068B", null)).toBe("/?room=44FE068B");
    expect(getPrivateRoomShareLink("44FE068B", "not a url")).toBe("/?room=44FE068B");
  });

  it("keeps fresher room and game sequence snapshots", () => {
    const current = {
      game: RUNNING_PONG_GAME,
      room: ACTIVE_PONG_ROOM,
      seq: 4,
    };
    const staleRoom = {
      game: {
        ...RUNNING_PONG_GAME,
        seq: RUNNING_PONG_GAME.seq + 1,
      },
      room: ACTIVE_PONG_ROOM,
      seq: 3,
    };
    const fresherGame = {
      game: {
        ...RUNNING_PONG_GAME,
        seq: RUNNING_PONG_GAME.seq + 1,
      },
      room: ACTIVE_PONG_ROOM,
      seq: 4,
    };

    expect(selectFreshMultiplayerRoomSnapshot(current, staleRoom)).toBe(current);
    expect(selectFreshMultiplayerRoomSnapshot(current, fresherGame)).toBe(fresherGame);
  });

});
