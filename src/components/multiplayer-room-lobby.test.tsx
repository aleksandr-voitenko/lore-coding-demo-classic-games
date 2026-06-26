import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CurrentUserProvider } from "@/hooks/use-current-user";
import type { PrivateRoom } from "@/lib/multiplayer/room";
import type { MultiplayerRoomGameSnapshot } from "@/lib/multiplayer/protocol";
import {
  createInitialPongGame,
  startPongGame,
} from "@/lib/pong-game-engine";
import type { PongMultiplayerGameSnapshot } from "@/lib/pong-multiplayer";

import {
  MULTIPLAYER_ROOMS_API_PATH,
  MultiplayerRoomLobby,
  createMultiplayerRoom,
  getMultiplayerRoomConnectionErrorState,
  getMultiplayerRoomStreamUnavailableMessage,
  getPrivateRoomShareLink,
  postMultiplayerRoomCommand,
  selectFreshMultiplayerRoomSnapshot,
  shouldPostMultiplayerRoomCommandOverHttp,
} from "./multiplayer-room-lobby";
import { getMultiplayerRoomGameRenderer } from "./multiplayer-room-game-registry";
import { MultiplayerRoomTransportError } from "./multiplayer-room-transport";

type RoomFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

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
    expect(
      getMultiplayerRoomGameRenderer(ACTIVE_PONG_ROOM, RUNNING_PONG_GAME)?.gameId,
    ).toBe("pong");
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

  it("keeps only host-only commands on HTTP while live commands require WebSockets", () => {
    expect(
      shouldPostMultiplayerRoomCommandOverHttp({
        command: "start",
        participantId: "host-participant",
        type: "room.lifecycle",
      }),
    ).toBe(true);
    expect(
      shouldPostMultiplayerRoomCommandOverHttp({
        participantId: "host-participant",
        settings: PONG_ROOM.settings,
        type: "room.updateSettings",
      }),
    ).toBe(true);
    expect(
      shouldPostMultiplayerRoomCommandOverHttp({
        displayName: "Katherine",
        type: "room.joinObserver",
        userId: null,
      }),
    ).toBe(false);
    expect(
      shouldPostMultiplayerRoomCommandOverHttp({
        participantId: "guest-participant",
        seatId: "right",
        type: "room.claimSeat",
      }),
    ).toBe(false);
    expect(
      shouldPostMultiplayerRoomCommandOverHttp({
        participantId: "guest-participant",
        seatId: "right",
        type: "room.releaseSeat",
      }),
    ).toBe(false);
    expect(
      shouldPostMultiplayerRoomCommandOverHttp({
        gameId: "pong",
        input: {
          direction: "up",
          type: "pong.setPaddleDirection",
        },
        participantId: "host-participant",
        type: "game.input",
      }),
    ).toBe(false);
    expect(getMultiplayerRoomStreamUnavailableMessage("unconfigured")).toBe(
      "Room stream is not configured. Live room commands require WebSockets.",
    );
    expect(getMultiplayerRoomStreamUnavailableMessage("unavailable")).toBe(
      "Room stream is unavailable. Live room commands require WebSockets.",
    );
    expect(getMultiplayerRoomStreamUnavailableMessage("connecting")).toBe(
      "Room stream is connecting. Try again once the WebSocket stream is ready.",
    );
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

  it("posts signed-in host room creation and derives the participant id from the snapshot", async () => {
    const fetcher = vi.fn<RoomFetch>(async () =>
      jsonResponse({
        participant: PONG_ROOM.participants[0],
        room: PONG_ROOM,
        seq: 1,
      }),
    );

    await expect(
      createMultiplayerRoom({
        fetcher,
        gameId: "pong",
        settings: PONG_ROOM.settings,
      }),
    ).resolves.toEqual({
      participantId: "host-participant",
      room: PONG_ROOM,
      seq: 1,
    });

    expect(fetcher).toHaveBeenCalledWith(
      MULTIPLAYER_ROOMS_API_PATH,
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      gameId: "pong",
      settings: PONG_ROOM.settings,
    });
  });

  it("posts host-only lifecycle and settings commands to the room endpoint", async () => {
    const fetcher = vi.fn<RoomFetch>(async () =>
      jsonResponse({ room: PONG_ROOM, seq: 3 }),
    );

    await postMultiplayerRoomCommand(
      "PONG-1",
      {
        command: "start",
        participantId: "host-participant",
        type: "room.lifecycle",
      },
      fetcher,
    );
    await postMultiplayerRoomCommand(
      "PONG-1",
      {
        participantId: "host-participant",
        settings: PONG_ROOM.settings,
        type: "room.updateSettings",
      },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      `${MULTIPLAYER_ROOMS_API_PATH}/PONG-1`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      command: "start",
      participantId: "host-participant",
      type: "room.lifecycle",
    });
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      participantId: "host-participant",
      settings: PONG_ROOM.settings,
      type: "room.updateSettings",
    });
  });

  it("surfaces API errors from non-2xx room responses", async () => {
    const fetcher = vi.fn<RoomFetch>(async () =>
      jsonResponse({ error: "Room not found." }, { status: 404 }),
    );

    await expect(
      postMultiplayerRoomCommand(
        "PONG-404",
        {
          command: "start",
          participantId: "host-participant",
          type: "room.lifecycle",
        },
        fetcher,
      ),
    ).rejects.toMatchObject({
      message: "Room not found.",
      status: 404,
    });
  });
});

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
    ...init,
  });
}
