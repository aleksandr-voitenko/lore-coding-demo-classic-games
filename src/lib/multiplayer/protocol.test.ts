import { describe, expect, it } from "vitest";

import { MULTIPLAYER_ROOM_PROTOCOL_VERSION } from "./protocol";
import type {
  MultiplayerRealtimeClientMessage,
  MultiplayerRealtimeGameInputMessage,
  MultiplayerRealtimeGameSnapshot,
  MultiplayerRealtimeRoomSnapshot,
  MultiplayerRealtimeServerMessage,
  MultiplayerRoomGameSnapshot,
  MultiplayerRoomSnapshot,
  MultiplayerTerminalSummary,
  PrivateRoomClientMessage,
  PrivateRoomCommandMessage,
  PrivateRoomServerMessage,
} from "./protocol";
import {
  createPrivateRoom,
  type PrivateRoom,
  type PrivateRoomSettings,
} from "./room";

const HOST_ID = "host-participant";
const HOST_USER_ID = "user-1";
const ROOM_CODE = "PROTO-1";

const TWO_PLAYER_SEATS = [
  {
    id: "left",
    label: "Left",
    required: true,
  },
  {
    id: "right",
    label: "Right",
    required: true,
  },
] as const;

function createProtocolRoom(settings: PrivateRoomSettings): PrivateRoom {
  const result = createPrivateRoom({
    code: ROOM_CODE,
    host: {
      displayName: "Host Player",
      participantId: HOST_ID,
      userId: HOST_USER_ID,
    },
    seats: TWO_PLAYER_SEATS,
    settings,
  });

  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.room;
}

describe("multiplayer realtime protocol", () => {
  it("carries connection hello, resume, diagnostics ping, and bootstrap messages for a room", () => {
    const hello = {
      displayName: "Guest Hero",
      protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
      roomCode: ROOM_CODE,
      type: "connection.hello",
    } satisfies MultiplayerRealtimeClientMessage;
    const resume = {
      lastSeq: {
        game: {
          matchId: 1,
          seq: 12,
        },
        room: 7,
      },
      participantCapability: "guest-capability",
      participantId: "guest-1",
      protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
      roomCode: ROOM_CODE,
      type: "connection.resume",
    } satisfies MultiplayerRealtimeClientMessage;
    const ping = {
      clientTimeMs: 1_000,
      requestId: "diagnostics-1",
      roomCode: ROOM_CODE,
      type: "connection.ping",
    } satisfies MultiplayerRealtimeClientMessage;
    const bootstrap = {
      displayName: "Guest Hero",
      participantId: "guest-1",
      protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
      roomCode: ROOM_CODE,
      snapshot: {
        room: createProtocolRoom({ gameId: "space-invaders" }),
        seq: 7,
      },
      type: "connection.bootstrap",
    } satisfies MultiplayerRealtimeServerMessage;

    expect(hello).toMatchObject({
      displayName: "Guest Hero",
      roomCode: ROOM_CODE,
    });
    expect(resume.lastSeq).toEqual({
      game: {
        matchId: 1,
        seq: 12,
      },
      room: 7,
    });
    expect(resume.participantCapability).toBe("guest-capability");
    expect(ping.clientTimeMs).toBe(1_000);
    expect(bootstrap.snapshot.room.settings.gameId).toBe("space-invaders");
  });

  it("wraps existing room commands without making each command a transport type", () => {
    const joinObserverCommand = {
      displayName: "Guest Hero",
      type: "room.joinObserver",
    } satisfies PrivateRoomCommandMessage;
    const claimSeatCommand = {
      participantId: "guest-1",
      seatId: "left",
      matchId: 1,
      type: "room.claimSeat",
    } satisfies PrivateRoomCommandMessage;
    const realtimeCommand = {
      command: claimSeatCommand,
      requestId: "request-claim",
      roomCode: ROOM_CODE,
      type: "room.command",
    } satisfies MultiplayerRealtimeClientMessage;
    const httpCommand = {
      participantId: HOST_ID,
      settings: {
        gameId: "asteroids",
        parameters: {
          difficulty: "hard",
        },
      },
      matchId: 1,
      type: "room.updateSettings",
    } satisfies PrivateRoomClientMessage;

    expect(joinObserverCommand).toEqual({
      displayName: "Guest Hero",
      type: "room.joinObserver",
    });
    expect(realtimeCommand.command.type).toBe("room.claimSeat");
    expect(httpCommand.type).toBe("room.updateSettings");
    expect(httpCommand.settings.gameId).toBe("asteroids");
  });

  it("keys game input by game id while nesting game-specific payloads", () => {
    const pongInput = {
      gameId: "pong",
      input: {
        direction: "up",
        type: "pong.setPaddleDirection",
      },
      participantId: "guest-left",
      roomCode: ROOM_CODE,
      matchId: 1,
      type: "game.input",
    } satisfies MultiplayerRealtimeGameInputMessage<"pong">;
    const asteroidsInput = {
      gameId: "asteroids",
      input: {
        rotation: -1,
        thrust: true,
        type: "asteroids.setControls",
      },
      participantId: "ship-1",
      roomCode: ROOM_CODE,
      matchId: 1,
      type: "game.input",
    } satisfies MultiplayerRealtimeGameInputMessage<
      "asteroids",
      {
        rotation: number;
        thrust: boolean;
        type: "asteroids.setControls";
      }
    >;

    expect(pongInput.type).toBe(asteroidsInput.type);
    expect(pongInput.gameId).toBe("pong");
    expect(asteroidsInput.gameId).toBe("asteroids");
    expect(asteroidsInput.input).toEqual({
      rotation: -1,
      thrust: true,
      type: "asteroids.setControls",
    });
  });

  it("keeps server room snapshots, game snapshots, events, acks, rejections, pings, and pongs generic", () => {
    const terminalSummary = {
      key: "space-invaders|mode=private-room|board=420x560|aliens=24",
      mode: "private-room",
      outcome: {
        score: 420,
      },
      seats: [
        {
          id: "ship-a",
          label: "Ship A",
          participant: {
            displayName: "Host Player",
            id: HOST_ID,
            role: "host",
            userId: HOST_USER_ID,
          },
        },
      ],
      settings: {
        gameId: "space-invaders",
      },
      status: "won",
    } satisfies MultiplayerTerminalSummary<"won", { score: number }>;
    const gameSnapshot = {
      gameId: "space-invaders",
      matchId: 1,
      seq: 3,
      serverTimeMs: 1_000,
      summary: terminalSummary,
      snapshot: {
        aliensRemaining: 14,
        wave: 2,
      },
    } satisfies MultiplayerRealtimeGameSnapshot<
      "space-invaders",
      {
        aliensRemaining: number;
        wave: number;
      },
      {
        summary: typeof terminalSummary;
      }
    >;
    const snapshot = {
      game: gameSnapshot,
      room: createProtocolRoom({ gameId: "space-invaders" }),
      seq: 8,
    } satisfies MultiplayerRealtimeRoomSnapshot<typeof gameSnapshot>;
    const snapshotMessage = {
      roomCode: ROOM_CODE,
      snapshot,
      type: "room.snapshot",
    } satisfies MultiplayerRealtimeServerMessage<typeof gameSnapshot>;
    const eventMessage = {
      event: {
        gameId: "space-invaders",
        gameSeq: 4,
        matchId: 1,
        payload: {
          participantId: "ship-1",
        },
        seq: 9,
        type: "game.playerJoined",
      },
      roomCode: ROOM_CODE,
      type: "room.event",
    } satisfies MultiplayerRealtimeServerMessage<typeof gameSnapshot>;
    const ackMessage = {
      gameSeq: 4,
      matchId: 1,
      participantId: "ship-1",
      requestId: "request-input",
      roomCode: ROOM_CODE,
      seq: 9,
      type: "room.commandAck",
    } satisfies MultiplayerRealtimeServerMessage<typeof gameSnapshot>;
    const rejectionMessage = {
      code: "invalid-command",
      error: "Command is not supported.",
      requestId: "request-bad",
      roomCode: ROOM_CODE,
      type: "room.commandRejected",
    } satisfies MultiplayerRealtimeServerMessage<typeof gameSnapshot>;
    const pingMessage = {
      nonce: "ping-1",
      serverTimeMs: 1_250,
      type: "connection.ping",
    } satisfies MultiplayerRealtimeServerMessage<typeof gameSnapshot>;
    const pongMessage = {
      clientTimeMs: 1_200,
      requestId: "diagnostics-1",
      roomCode: ROOM_CODE,
      serverTimeMs: 1_225,
      type: "connection.pong",
    } satisfies MultiplayerRealtimeServerMessage<typeof gameSnapshot>;

    expect(snapshotMessage.snapshot.seq).toBe(8);
    expect(snapshotMessage.snapshot.game.seq).toBe(3);
    expect(snapshotMessage.snapshot.game.summary.key).toBe(
      "space-invaders|mode=private-room|board=420x560|aliens=24",
    );
    expect(eventMessage.event.gameSeq).toBe(4);
    expect(ackMessage.seq).toBe(9);
    expect(rejectionMessage.code).toBe("invalid-command");
    expect(pingMessage.serverTimeMs).toBe(1_250);
    expect(pongMessage.clientTimeMs).toBe(1_200);
  });

  it("keeps room snapshot aliases compatible with nested game-specific payloads", () => {
    const game = {
      fleet: {
        columns: 11,
      },
      gameId: "space-invaders",
      matchId: 1,
      seq: 2,
      serverTimeMs: 500,
      snapshot: {
        aliensRemaining: 14,
        wave: 2,
      },
    } satisfies MultiplayerRoomGameSnapshot<
      "space-invaders",
      {
        aliensRemaining: number;
        wave: number;
      },
      {
        fleet: {
          columns: number;
        };
      }
    >;
    const snapshot = {
      game,
      room: createProtocolRoom({ gameId: "space-invaders" }),
      seq: 5,
    } satisfies MultiplayerRoomSnapshot;
    const serverMessage = {
      game,
      room: snapshot.room,
      seq: snapshot.seq,
      type: "room.snapshot",
    } satisfies PrivateRoomServerMessage<typeof game>;
    const clientMessage = {
      gameId: "space-invaders",
      input: {
        fire: true,
        type: "space-invaders.setControls",
      },
      participantId: "guest-left",
      requestId: "request-serve",
      matchId: 1,
      type: "game.input",
    } satisfies PrivateRoomClientMessage<
      "space-invaders",
      {
        fire: boolean;
        type: "space-invaders.setControls";
      }
    >;

    expect(serverMessage.game?.fleet.columns).toBe(11);
    expect(serverMessage.game?.snapshot.wave).toBe(2);
    expect(clientMessage.gameId).toBe("space-invaders");
  });
});
