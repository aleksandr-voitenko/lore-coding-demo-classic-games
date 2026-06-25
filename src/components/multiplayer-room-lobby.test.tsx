import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CurrentUserProvider } from "@/hooks/use-current-user";
import type { PrivateRoom } from "@/lib/multiplayer/room";

import {
  MULTIPLAYER_ROOMS_API_PATH,
  MultiplayerRoomLobby,
  createMultiplayerRoom,
  fetchMultiplayerRoom,
  postMultiplayerRoomCommand,
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

  it("loads room snapshots from the committed room-code endpoint", async () => {
    const fetcher = vi.fn<RoomFetch>(async () =>
      jsonResponse({ room: PONG_ROOM, seq: 1 }),
    );

    await expect(fetchMultiplayerRoom("pong-1", fetcher)).resolves.toEqual({
      room: PONG_ROOM,
    });

    expect(fetcher).toHaveBeenCalledWith(`${MULTIPLAYER_ROOMS_API_PATH}/PONG-1`, {
      cache: "no-store",
    });
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
