import { describe, expect, it, vi } from "vitest";

import type { PrivateRoom } from "@/lib/multiplayer/room";

import {
  MULTIPLAYER_ROOMS_API_PATH,
  MultiplayerRoomRequestError,
  createMultiplayerRoom,
  dispatchMultiplayerRoomClientMessage,
  getMultiplayerRoomStreamUnavailableMessage,
  postMultiplayerRoomCommand,
  shouldPostMultiplayerRoomCommandOverHttp,
  type MultiplayerRoomClientCommandTransport,
  type MultiplayerRoomClientSnapshot,
} from "./multiplayer-room-client";

type RoomFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const ROOM: PrivateRoom = {
  code: "ROOM1",
  hostParticipantId: "host-1",
  participants: [
    {
      displayName: "Ada",
      id: "host-1",
      role: "host",
      userId: "user-1",
    },
    {
      displayName: "Grace",
      id: "guest-1",
      role: "observer",
      userId: null,
    },
  ],
  seats: [
    {
      id: "left",
      label: "Left Paddle",
      occupiedByParticipantId: "host-1",
      required: true,
    },
  ],
  settings: {
    gameId: "pong",
  },
  status: "lobby",
};

const HTTP_SNAPSHOT = {
  participantId: "host-1",
  room: ROOM,
  seq: 2,
} satisfies MultiplayerRoomClientSnapshot;

function createTransport(
  status: MultiplayerRoomClientCommandTransport["status"] = "active",
): MultiplayerRoomClientCommandTransport {
  return {
    sendGameInput: vi.fn(async () => ({ gameSeq: 4, seq: 3 })),
    sendRoomCommand: vi.fn(async () => ({ participantId: "guest-1", seq: 3 })),
    status,
  };
}

describe("multiplayer room client command dispatch", () => {
  it("classifies only authenticated host commands for HTTP dispatch", () => {
    expect(
      shouldPostMultiplayerRoomCommandOverHttp({
        command: "start",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    ).toBe(true);
    expect(
      shouldPostMultiplayerRoomCommandOverHttp({
        participantId: "host-1",
        settings: ROOM.settings,
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
        participantId: "guest-1",
        seatId: "left",
        type: "room.claimSeat",
      }),
    ).toBe(false);
    expect(
      shouldPostMultiplayerRoomCommandOverHttp({
        participantId: "guest-1",
        seatId: "left",
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
        participantId: "guest-1",
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

  it.each([
    "active",
    "connecting",
    "reconnecting",
    "unavailable",
    "unconfigured",
  ] as const)(
    "keeps authenticated host commands on HTTP while the stream is %s",
    async (status) => {
      const transport = createTransport(status);
      const postHostCommand = vi.fn(async () => HTTP_SNAPSHOT);
      const message = {
        command: "start",
        participantId: "host-1",
        type: "room.lifecycle",
      } as const;

      await expect(
        dispatchMultiplayerRoomClientMessage({
          message,
          postHostCommand,
          roomCode: "room1",
          transport,
        }),
      ).resolves.toBe(HTTP_SNAPSHOT);

      expect(postHostCommand).toHaveBeenCalledWith("ROOM1", message);
      expect(transport.sendRoomCommand).not.toHaveBeenCalled();
      expect(transport.sendGameInput).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      label: "observer join",
      message: {
        displayName: "Katherine",
        type: "room.joinObserver",
        userId: null,
      },
    },
    {
      label: "seat claim",
      message: {
        participantId: "guest-1",
        seatId: "left",
        type: "room.claimSeat",
      },
    },
    {
      label: "seat release",
      message: {
        participantId: "guest-1",
        seatId: "left",
        type: "room.releaseSeat",
      },
    },
  ] as const)("dispatches $label through an active stream", async ({ message }) => {
    const transport = createTransport();
    const postHostCommand = vi.fn(async () => HTTP_SNAPSHOT);

    await expect(
      dispatchMultiplayerRoomClientMessage({
        message,
        postHostCommand,
        roomCode: "ROOM1",
        transport,
      }),
    ).resolves.toEqual({ participantId: "guest-1", seq: 3 });

    expect(transport.sendRoomCommand).toHaveBeenCalledWith(message);
    expect(transport.sendGameInput).not.toHaveBeenCalled();
    expect(postHostCommand).not.toHaveBeenCalled();
  });

  it("dispatches game input through an active stream", async () => {
    const transport = createTransport();
    const postHostCommand = vi.fn(async () => HTTP_SNAPSHOT);
    const gameInput = {
      gameId: "pong",
      input: {
        direction: "up",
        type: "pong.setPaddleDirection",
      },
      participantId: "guest-1",
      type: "game.input",
    } as const;

    await expect(
      dispatchMultiplayerRoomClientMessage({
        message: gameInput,
        postHostCommand,
        roomCode: "ROOM1",
        transport,
      }),
    ).resolves.toEqual({ gameSeq: 4, seq: 3 });

    expect(transport.sendGameInput).toHaveBeenCalledWith(
      "pong",
      gameInput.input,
      "guest-1",
    );
    expect(transport.sendRoomCommand).not.toHaveBeenCalled();
    expect(postHostCommand).not.toHaveBeenCalled();
  });

  it.each([
    ["unconfigured", "Room stream is not configured."],
    ["unavailable", "Room stream is unavailable."],
    ["connecting", "Room stream is connecting."],
    ["reconnecting", "Room stream is reconnecting."],
  ] as const)(
    "rejects live commands while the stream is %s",
    async (status, expectedMessage) => {
      const transport = createTransport(status);

      await expect(
        dispatchMultiplayerRoomClientMessage({
          message: {
            participantId: "guest-1",
            seatId: "left",
            type: "room.claimSeat",
          },
          roomCode: "ROOM1",
          transport,
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining(expectedMessage),
        status: 0,
      });
    },
  );

  it("rejects an invalid room code before selecting a transport", async () => {
    const transport = createTransport();

    await expect(
      dispatchMultiplayerRoomClientMessage({
        message: {
          participantId: "guest-1",
          seatId: "left",
          type: "room.claimSeat",
        },
        roomCode: "bad room",
        transport,
      }),
    ).rejects.toEqual(
      new MultiplayerRoomRequestError("Room code is not supported.", 400),
    );

    expect(transport.sendRoomCommand).not.toHaveBeenCalled();
  });
});

describe("multiplayer room HTTP client", () => {
  it("creates a signed-in host room and derives the participant from the snapshot", async () => {
    const fetcher = vi.fn<RoomFetch>(async () =>
      jsonResponse({
        participant: ROOM.participants[0],
        room: ROOM,
        seq: 1,
      }),
    );

    await expect(
      createMultiplayerRoom({
        fetcher,
        gameId: "pong",
        settings: ROOM.settings,
      }),
    ).resolves.toEqual({
      participantId: "host-1",
      room: ROOM,
      seq: 1,
    });

    expect(fetcher).toHaveBeenCalledWith(
      MULTIPLAYER_ROOMS_API_PATH,
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      gameId: "pong",
      settings: ROOM.settings,
    });
  });

  it.each([
    {
      name: "malformed participants",
      room: {
        ...ROOM,
        participants: "not-a-participant-list",
      },
    },
    {
      name: "a deeply nested invalid setting",
      room: createRoomWithSettingValue(
        createDeepSettingValue(undefined, 20_000),
      ),
    },
    {
      name: "a cyclic setting",
      room: createRoomWithSettingValue(createCyclicSettingValue()),
    },
  ])("rejects a successful room API snapshot with $name", async ({ room }) => {
    const fetcher = vi.fn<RoomFetch>(async () =>
      objectResponse({
        participant: ROOM.participants[0],
        room,
        seq: 1,
      }),
    );

    await expect(
      createMultiplayerRoom({
        fetcher,
        gameId: "pong",
        settings: ROOM.settings,
      }),
    ).rejects.toMatchObject({
      message: "Create room response included an invalid room snapshot.",
      status: 200,
    });
  });

  it("posts host-only lifecycle and settings commands to the room endpoint", async () => {
    const fetcher = vi.fn<RoomFetch>(async () =>
      jsonResponse({ room: ROOM, seq: 3 }),
    );

    await postMultiplayerRoomCommand(
      "room1",
      {
        command: "start",
        participantId: "host-1",
        type: "room.lifecycle",
      },
      fetcher,
    );
    await postMultiplayerRoomCommand(
      "ROOM1",
      {
        participantId: "host-1",
        settings: ROOM.settings,
        type: "room.updateSettings",
      },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      `${MULTIPLAYER_ROOMS_API_PATH}/ROOM1`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      command: "start",
      participantId: "host-1",
      type: "room.lifecycle",
    });
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      participantId: "host-1",
      settings: ROOM.settings,
      type: "room.updateSettings",
    });
  });

  it("surfaces API errors from non-2xx room responses", async () => {
    const fetcher = vi.fn<RoomFetch>(async () =>
      jsonResponse({ error: "Room not found." }, { status: 404 }),
    );

    await expect(
      postMultiplayerRoomCommand(
        "ROOM1",
        {
          command: "start",
          participantId: "host-1",
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

function objectResponse(payload: unknown) {
  return {
    json: async () => payload,
    ok: true,
    status: 200,
  } as Response;
}

function createRoomWithSettingValue(value: unknown) {
  return {
    ...ROOM,
    settings: {
      gameId: "pong",
      parameters: {
        value,
      },
    },
  };
}

function createDeepSettingValue(leaf: unknown, depth: number) {
  let value = leaf;

  for (let index = 0; index < depth; index += 1) {
    value = { nested: value };
  }

  return value;
}

function createCyclicSettingValue() {
  const value: Record<string, unknown> = {};

  value.self = value;

  return value;
}
