import { describe, expect, it } from "vitest";

import { createInitialPongGame } from "../pong-game-engine";
import type {
  MultiplayerRealtimeClientMessage,
  MultiplayerRealtimeGameInputMessage,
  MultiplayerRealtimeGameSnapshot,
  MultiplayerRealtimeRoomSnapshot,
  MultiplayerRealtimeServerMessage,
  MultiplayerRoomGameSnapshot,
  MultiplayerRoomSnapshot,
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
  it("carries connection hello, resume, and bootstrap messages for a room", () => {
    const hello = {
      displayName: "Guest Hero",
      roomCode: ROOM_CODE,
      type: "connection.hello",
    } satisfies MultiplayerRealtimeClientMessage;
    const resume = {
      lastSeq: {
        game: 12,
        room: 7,
      },
      participantId: "guest-1",
      roomCode: ROOM_CODE,
      type: "connection.resume",
    } satisfies MultiplayerRealtimeClientMessage;
    const bootstrap = {
      displayName: "Guest Hero",
      participantId: "guest-1",
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
      game: 12,
      room: 7,
    });
    expect(bootstrap.snapshot.room.settings.gameId).toBe("space-invaders");
  });

  it("wraps existing room commands without making each command a transport type", () => {
    const claimSeatCommand = {
      participantId: "guest-1",
      seatId: "left",
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
      type: "room.updateSettings",
    } satisfies PrivateRoomClientMessage;

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

  it("keeps server room snapshots, game snapshots, events, acks, rejections, and pings generic", () => {
    const gameSnapshot = {
      gameId: "space-invaders",
      seq: 3,
      serverTimeMs: 1_000,
      snapshot: {
        aliensRemaining: 14,
        wave: 2,
      },
    } satisfies MultiplayerRealtimeGameSnapshot<
      "space-invaders",
      {
        aliensRemaining: number;
        wave: number;
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

    expect(snapshotMessage.snapshot.seq).toBe(8);
    expect(snapshotMessage.snapshot.game.seq).toBe(3);
    expect(eventMessage.event.gameSeq).toBe(4);
    expect(ackMessage.seq).toBe(9);
    expect(rejectionMessage.code).toBe("invalid-command");
    expect(pingMessage.serverTimeMs).toBe(1_250);
  });

  it("keeps current Pong room snapshot aliases compatible with nested payloads", () => {
    const game = {
      gameId: "pong",
      heldInputs: {
        left: {
          up: true,
        },
      },
      seq: 2,
      serverTimeMs: 500,
      snapshot: createInitialPongGame(),
    } satisfies MultiplayerRoomGameSnapshot;
    const snapshot = {
      game,
      room: createProtocolRoom({ gameId: "pong" }),
      seq: 5,
    } satisfies MultiplayerRoomSnapshot;
    const serverMessage = {
      game,
      room: snapshot.room,
      seq: snapshot.seq,
      type: "room.snapshot",
    } satisfies PrivateRoomServerMessage;
    const clientMessage = {
      gameId: "pong",
      input: {
        type: "pong.serve",
      },
      participantId: "guest-left",
      requestId: "request-serve",
      type: "game.input",
    } satisfies PrivateRoomClientMessage;

    expect(serverMessage.game?.heldInputs.left?.up).toBe(true);
    expect(serverMessage.game?.snapshot.status).toBe("ready");
    expect(clientMessage.gameId).toBe("pong");
  });
});
