import { describe, expect, it } from "vitest";

import { MULTIPLAYER_ROOM_PROTOCOL_VERSION } from "./protocol";
import type {
  MultiplayerRealtimeServerMessage,
  MultiplayerRoomSnapshot,
} from "./protocol";
import {
  isMultiplayerRealtimeServerMessage,
  isMultiplayerRoomSnapshot,
} from "./protocol-validation";
import type { PrivateRoom } from "./room";

const ROOM = {
  code: "ROOM1",
  hostParticipantId: "host-1",
  matchId: 1,
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
      role: "player",
      userId: null,
    },
  ],
  seats: [
    {
      id: "left",
      label: "Left",
      occupiedByParticipantId: "host-1",
      required: true,
    },
    {
      id: "right",
      label: "Right",
      occupiedByParticipantId: "guest-1",
      required: true,
    },
  ],
  settings: {
    gameId: "pong",
    parameters: {
      target: 5,
    },
  },
  status: "running",
} satisfies PrivateRoom;

const GAME_SNAPSHOT = {
  gameId: "pong",
  matchId: 1,
  seq: 3,
  serverTimeMs: 1_000,
  snapshot: {
    futureGameState: true,
  },
} as const;

const SNAPSHOT = {
  game: {
    ...GAME_SNAPSHOT,
    futureGameEnvelopeField: true,
  },
  participant: ROOM.participants[1],
  room: ROOM,
  seq: 4,
} satisfies MultiplayerRoomSnapshot<typeof GAME_SNAPSHOT & {
  futureGameEnvelopeField: boolean;
}>;

describe("multiplayer protocol validation", () => {
  it("accepts every known server discriminant and preserves forward-compatible fields", () => {
    const bootstrap = {
      participantId: "guest-1",
      protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
      requestId: "bootstrap-1",
      roomCode: "ROOM1",
      snapshot: SNAPSHOT,
      type: "connection.bootstrap",
    } satisfies MultiplayerRealtimeServerMessage<typeof SNAPSHOT.game>;
    const bootstrapWithFutureField = {
      ...bootstrap,
      futureEnvelopeField: true,
    };
    const messages = [
      bootstrapWithFutureField,
      {
        roomCode: "ROOM1",
        snapshot: SNAPSHOT,
        type: "room.snapshot",
      },
      {
        event: {
          gameId: "pong",
          gameSeq: 4,
          matchId: 1,
          payload: {
            state: "advanced",
          },
          seq: 5,
          type: "game.advanced",
        },
        roomCode: "ROOM1",
        type: "room.event",
      },
      {
        gameSeq: 4,
        matchId: 1,
        participantCapability: "guest-capability",
        participantId: "guest-1",
        requestId: "command-1",
        roomCode: "ROOM1",
        seq: 5,
        type: "room.commandAck",
      },
      {
        code: "seat-occupied",
        error: "Seat is occupied.",
        requestId: "command-2",
        roomCode: "ROOM1",
        type: "room.commandRejected",
      },
      {
        code: "room-expired",
        error: "Room has expired.",
        requestId: "connection-2",
        roomCode: "ROOM1",
        type: "room.commandRejected",
      },
      {
        code: "participant-unauthorized",
        error: "Participant credentials are invalid.",
        requestId: "connection-3",
        roomCode: "ROOM1",
        type: "room.commandRejected",
      },
      {
        code: "protocol-version-mismatch",
        error: "Refresh the page.",
        requestId: "connection-4",
        roomCode: "ROOM1",
        type: "room.commandRejected",
      },
      {
        code: "stale-match",
        error: "Refresh the party.",
        requestId: "connection-5",
        roomCode: "ROOM1",
        type: "room.commandRejected",
      },
      {
        nonce: "ping-1",
        serverTimeMs: 1_100,
        type: "connection.ping",
      },
      {
        clientTimeMs: 1_100,
        requestId: "diagnostics-1",
        roomCode: "ROOM1",
        serverTimeMs: 1_120,
        type: "connection.pong",
      },
    ] satisfies readonly MultiplayerRealtimeServerMessage<typeof SNAPSHOT.game>[];

    for (const message of messages) {
      expect(isMultiplayerRealtimeServerMessage(message, "ROOM1")).toBe(true);
    }

    expect(bootstrapWithFutureField.futureEnvelopeField).toBe(true);
    expect(SNAPSHOT.game.futureGameEnvelopeField).toBe(true);
  });

  it.each([
    ["missing snapshot", { roomCode: "ROOM1", type: "room.snapshot" }],
    [
      "negative sequence",
      {
        roomCode: "ROOM1",
        snapshot: { ...SNAPSHOT, seq: -1 },
        type: "room.snapshot",
      },
    ],
    [
      "fractional acknowledgement sequence",
      { roomCode: "ROOM1", seq: 1.5, type: "room.commandAck" },
    ],
    [
      "acknowledgement without a match id",
      { roomCode: "ROOM1", seq: 2, type: "room.commandAck" },
    ],
    [
      "participant capability without a participant id",
      {
        participantCapability: "guest-capability",
        roomCode: "ROOM1",
        seq: 2,
        type: "room.commandAck",
      },
    ],
    [
      "mismatched nested room code",
      { roomCode: "OTHER", snapshot: SNAPSHOT, type: "room.snapshot" },
    ],
    [
      "mismatched expected room code",
      { roomCode: "ROOM1", snapshot: SNAPSHOT, type: "room.snapshot" },
    ],
    [
      "missing event type",
      {
        event: { payload: {}, seq: 5 },
        roomCode: "ROOM1",
        type: "room.event",
      },
    ],
    [
      "unknown rejection code",
      {
        code: "not-a-code",
        error: "Rejected.",
        type: "room.commandRejected",
      },
    ],
    [
      "invalid ping timestamp",
      { serverTimeMs: Number.NaN, type: "connection.ping" },
    ],
    [
      "invalid pong timestamp",
      {
        clientTimeMs: 1_000,
        serverTimeMs: -1,
        type: "connection.pong",
      },
    ],
    ["unknown type", { type: "room.futureMessage" }],
  ])("rejects %s", (name, message) => {
    expect(
      isMultiplayerRealtimeServerMessage(
        message,
        name === "mismatched expected room code" ? "OTHER" : "ROOM1",
      ),
    ).toBe(false);
  });

  it.each([
    ["a non-object snapshot", null],
    ["a negative room sequence", { ...SNAPSHOT, seq: -1 }],
    [
      "an invalid room match id",
      { ...SNAPSHOT, room: { ...ROOM, matchId: 0 } },
    ],
    [
      "a malformed participant",
      {
        ...SNAPSHOT,
        participant: {
          ...SNAPSHOT.participant,
          id: 7,
        },
      },
    ],
    [
      "a participant not present in the room",
      {
        ...SNAPSHOT,
        participant: {
          ...SNAPSHOT.participant,
          id: "guest-2",
        },
      },
    ],
    [
      "an unknown seat occupant",
      {
        ...SNAPSHOT,
        room: {
          ...ROOM,
          seats: [
            {
              ...ROOM.seats[0],
              occupiedByParticipantId: "missing-participant",
            },
          ],
        },
      },
    ],
    [
      "a mismatched game id",
      {
        ...SNAPSHOT,
        game: {
          ...SNAPSHOT.game,
          gameId: "asteroids",
        },
      },
    ],
    [
      "a mismatched game match id",
      {
        ...SNAPSHOT,
        game: {
          ...SNAPSHOT.game,
          matchId: 2,
        },
      },
    ],
    [
      "a game envelope without state",
      {
        ...SNAPSHOT,
      game: {
        gameId: "pong",
        matchId: 1,
          seq: 3,
          serverTimeMs: 1_000,
        },
      },
    ],
    [
      "a game envelope with primitive state",
      {
        ...SNAPSHOT,
        game: {
          ...SNAPSHOT.game,
          snapshot: "not-game-state",
        },
      },
    ],
  ])("rejects %s", (_name, snapshot) => {
    expect(isMultiplayerRoomSnapshot(snapshot)).toBe(false);
  });

  it.each([
    {
      name: "duplicate participant ids",
      room: {
        ...ROOM,
        participants: [
          ROOM.participants[0],
          { ...ROOM.participants[1], id: "host-1" },
        ],
      },
    },
    {
      name: "a missing host participant",
      room: {
        ...ROOM,
        hostParticipantId: "missing-host",
      matchId: 1,
      },
    },
    {
      name: "multiple host participants",
      room: {
        ...ROOM,
        participants: [
          ROOM.participants[0],
          { ...ROOM.participants[1], role: "host", userId: "user-2" },
        ],
      },
    },
    {
      name: "duplicate seat ids",
      room: {
        ...ROOM,
        seats: [ROOM.seats[0], { ...ROOM.seats[1], id: "left" }],
      },
    },
    {
      name: "only one player seat",
      room: {
        ...ROOM,
        seats: [ROOM.seats[0]],
      },
    },
    {
      name: "three player seats",
      room: {
        ...ROOM,
        seats: [
          ...ROOM.seats,
          {
            id: "center",
            label: "Center",
            occupiedByParticipantId: null,
            required: true,
          },
        ],
      },
    },
    {
      name: "an optional player seat",
      room: {
        ...ROOM,
        seats: [ROOM.seats[0], { ...ROOM.seats[1], required: false }],
      },
    },
    {
      name: "one participant occupying multiple seats",
      room: {
        ...ROOM,
        seats: [
          ROOM.seats[0],
          { ...ROOM.seats[1], occupiedByParticipantId: "host-1" },
        ],
      },
    },
    {
      name: "a player without a seat",
      room: {
        ...ROOM,
        seats: [
          ROOM.seats[0],
          { ...ROOM.seats[1], occupiedByParticipantId: null },
        ],
      },
    },
    {
      name: "an observer occupying a seat",
      room: {
        ...ROOM,
        participants: [
          ROOM.participants[0],
          { ...ROOM.participants[1], role: "observer" },
        ],
      },
    },
  ])("rejects room state with $name", ({ room }) => {
    expect(isMultiplayerRoomSnapshot({ ...SNAPSHOT, room })).toBe(false);
  });

  it("accepts deeply nested JSON-like room settings without a recursion limit", () => {
    const nestedSetting = createDeepSettingValue(
      [true, null, 42, "future-setting"],
      20_000,
    );

    expect(
      isMultiplayerRoomSnapshot({
        ...SNAPSHOT,
        room: {
          ...ROOM,
          settings: {
            gameId: "pong",
            parameters: {
              nested: nestedSetting,
            },
          },
        },
      }),
    ).toBe(true);
  });

  it("rejects shared setting references that cannot occur in JSON", () => {
    const sharedSetting = { enabled: true };

    expect(
      isMultiplayerRoomSnapshot({
        ...SNAPSHOT,
        room: {
          ...ROOM,
          settings: {
            gameId: "pong",
            parameters: {
              first: sharedSetting,
              second: sharedSetting,
            },
          },
        },
      }),
    ).toBe(false);
  });

  it("returns false instead of leaking reflective property-access errors", () => {
    const throwingValue = new Proxy(
      {},
      {
        get() {
          throw new Error("Property access failed.");
        },
      },
    );

    expect(isMultiplayerRoomSnapshot(throwingValue)).toBe(false);
    expect(isMultiplayerRealtimeServerMessage(throwingValue)).toBe(false);
  });

  it("accepts an opaque object game state without duplicating game schemas", () => {
    expect(isMultiplayerRoomSnapshot(SNAPSHOT)).toBe(true);
  });

  it("keeps generic room envelopes valid for catalog games without adapters", () => {
    const snapshot = {
      game: {
        gameId: "snake",
        matchId: 1,
        seq: 1,
        serverTimeMs: 1_000,
        snapshot: {},
      },
      room: {
        ...ROOM,
        settings: {
          gameId: "snake",
        },
      },
      seq: 1,
    } satisfies MultiplayerRoomSnapshot;

    expect(isMultiplayerRoomSnapshot(snapshot)).toBe(true);
  });
});

function createDeepSettingValue(leaf: unknown, depth: number) {
  let value = leaf;

  for (let index = 0; index < depth; index += 1) {
    value = { nested: value };
  }

  return value;
}
