import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CurrentUserProvider } from "@/hooks/use-current-user";
import type { MultiplayerRoomGameSnapshot } from "@/lib/multiplayer/protocol";
import type { PrivateRoom } from "@/lib/multiplayer/room";
import {
  createInitialPongGame,
  pausePongGame,
  startPongGame,
} from "@/lib/pong-game-engine";

import {
  MULTIPLAYER_ROOMS_API_PATH,
  MultiplayerRoomLobby,
  createMultiplayerRoom,
  fetchMultiplayerRoom,
  getMultiplayerRoomPollingDelayMs,
  postMultiplayerRoomCommand,
  selectFreshMultiplayerRoomSnapshot,
} from "./multiplayer-room-lobby";

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

const RUNNING_PONG_GAME = {
  gameId: "pong",
  seq: 1,
  serverTimeMs: 1_000,
  snapshot: startPongGame(createInitialPongGame()),
} satisfies MultiplayerRoomGameSnapshot;

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

  it("loads room snapshots from the committed room-code endpoint", async () => {
    const fetcher = vi.fn<RoomFetch>(async () =>
      jsonResponse({ room: PONG_ROOM, seq: 1 }),
    );

    await expect(fetchMultiplayerRoom("pong-1", fetcher)).resolves.toEqual({
      room: PONG_ROOM,
      seq: 1,
    });

    expect(fetcher).toHaveBeenCalledWith(`${MULTIPLAYER_ROOMS_API_PATH}/PONG-1`, {
      cache: "no-store",
    });
  });

  it("preserves optional Pong game snapshots from room payloads", async () => {
    const fetcher = vi.fn<RoomFetch>(async () =>
      jsonResponse({
        game: RUNNING_PONG_GAME,
        room: ACTIVE_PONG_ROOM,
        seq: 5,
      }),
    );

    await expect(fetchMultiplayerRoom("PONG-1", fetcher)).resolves.toEqual({
      game: RUNNING_PONG_GAME,
      room: ACTIVE_PONG_ROOM,
      seq: 5,
    });
  });

  it("selects polling delay from lobby and Pong game state", () => {
    expect(getMultiplayerRoomPollingDelayMs(null)).toBe(1_250);
    expect(
      getMultiplayerRoomPollingDelayMs({
        room: PONG_ROOM,
      }),
    ).toBe(1_250);
    expect(
      getMultiplayerRoomPollingDelayMs({
        game: RUNNING_PONG_GAME,
        room: ACTIVE_PONG_ROOM,
      }),
    ).toBe(60);
    expect(
      getMultiplayerRoomPollingDelayMs({
        game: {
          ...RUNNING_PONG_GAME,
          snapshot: createInitialPongGame(),
        },
        room: ACTIVE_PONG_ROOM,
      }),
    ).toBe(250);
    expect(
      getMultiplayerRoomPollingDelayMs({
        game: {
          ...RUNNING_PONG_GAME,
          snapshot: pausePongGame(RUNNING_PONG_GAME.snapshot),
        },
        room: ACTIVE_PONG_ROOM,
      }),
    ).toBe(250);
    expect(
      getMultiplayerRoomPollingDelayMs({
        game: {
          ...RUNNING_PONG_GAME,
          snapshot: {
            ...RUNNING_PONG_GAME.snapshot,
            status: "won",
          },
        },
        room: ACTIVE_PONG_ROOM,
      }),
    ).toBe(1_000);
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

  it("posts guest observer joins and returns the assigned participant", async () => {
    const joinedRoom: PrivateRoom = {
      ...PONG_ROOM,
      participants: [
        ...PONG_ROOM.participants,
        {
          displayName: "Katherine",
          id: "new-participant",
          role: "observer",
          userId: null,
        },
      ],
    };
    const fetcher = vi.fn<RoomFetch>(async () =>
      jsonResponse({
        participant: joinedRoom.participants.at(-1),
        room: joinedRoom,
        seq: 2,
      }),
    );

    await expect(
      postMultiplayerRoomCommand(
        "PONG-1",
        {
          displayName: "Katherine",
          type: "room.joinObserver",
          userId: null,
        },
        fetcher,
      ),
    ).resolves.toEqual({
      participantId: "new-participant",
      room: joinedRoom,
      seq: 2,
    });

    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      displayName: "Katherine",
      type: "room.joinObserver",
      userId: null,
    });
  });

  it("posts seat claim and release commands to the room endpoint", async () => {
    const fetcher = vi.fn<RoomFetch>(async () =>
      jsonResponse({ room: PONG_ROOM, seq: 3 }),
    );

    await postMultiplayerRoomCommand(
      "PONG-1",
      {
        participantId: "guest-participant",
        seatId: "right",
        type: "room.claimSeat",
      },
      fetcher,
    );
    await postMultiplayerRoomCommand(
      "PONG-1",
      {
        participantId: "guest-participant",
        seatId: "right",
        type: "room.releaseSeat",
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
      participantId: "guest-participant",
      seatId: "right",
      type: "room.claimSeat",
    });
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      participantId: "guest-participant",
      seatId: "right",
      type: "room.releaseSeat",
    });
  });

  it("posts Pong game input commands without a client side", async () => {
    const fetcher = vi.fn<RoomFetch>(async () =>
      jsonResponse({
        game: RUNNING_PONG_GAME,
        room: ACTIVE_PONG_ROOM,
        seq: 4,
      }),
    );

    await postMultiplayerRoomCommand(
      "PONG-1",
      {
        input: {
          direction: "up",
          type: "pong.setPaddleDirection",
        },
        participantId: "host-participant",
        type: "game.input",
      },
      fetcher,
    );
    await postMultiplayerRoomCommand(
      "PONG-1",
      {
        input: {
          type: "pong.serve",
        },
        participantId: "guest-participant",
        type: "game.input",
      },
      fetcher,
    );

    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      input: {
        direction: "up",
        type: "pong.setPaddleDirection",
      },
      participantId: "host-participant",
      type: "game.input",
    });
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      input: {
        type: "pong.serve",
      },
      participantId: "guest-participant",
      type: "game.input",
    });
  });

  it("surfaces API errors from non-2xx room responses", async () => {
    const fetcher = vi.fn<RoomFetch>(async () =>
      jsonResponse({ error: "Room not found." }, { status: 404 }),
    );

    await expect(fetchMultiplayerRoom("PONG-404", fetcher)).rejects.toMatchObject({
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
