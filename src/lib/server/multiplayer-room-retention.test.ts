import { describe, expect, it } from "vitest";

import { getPongTickDelay } from "../pong-game-engine";
import type { PongMultiplayerGameSnapshot } from "../pong-multiplayer";
import {
  InProcessMultiplayerRoomStore,
  getMultiplayerRoomStoreErrorStatus,
  type MultiplayerRoomSnapshot,
  type MultiplayerRoomStoreResult,
} from "./multiplayer-room-runtime";

const MINUTE_MS = 60_000;

const TEST_RETENTION_POLICY = {
  inProgressIdleTtlMs: 120 * MINUTE_MS,
  lobbyIdleTtlMs: 60 * MINUTE_MS,
  sweepIntervalMs: MINUTE_MS,
  terminalTtlMs: 30 * MINUTE_MS,
  tombstoneTtlMs: 5 * MINUTE_MS,
} as const;

const HOST_USER = {
  displayName: "Ada Host",
  id: "user-1",
};
const PARTY_SEATS = [
  { id: "left", label: "Left", required: true },
  { id: "right", label: "Right", required: true },
] as const;

function createRetentionStore({
  maxRooms = 256,
  participantIds = ["host-1", "guest-1"],
  roomCodes = ["ROOM1", "ROOM2", "ROOM3", "ROOM4"],
}: {
  maxRooms?: number;
  participantIds?: string[];
  roomCodes?: string[];
} = {}) {
  let nowMs = 0;
  let participantIdIndex = 0;
  let roomCodeIndex = 0;
  const store = new InProcessMultiplayerRoomStore({
    createParticipantId: ({ role }) =>
      participantIds[participantIdIndex++] ?? `${role}-${participantIdIndex}`,
    createRoomCode: () => roomCodes[roomCodeIndex++] ?? `ROOM${roomCodeIndex}`,
    getNowMs: () => nowMs,
    maxRooms,
    retentionPolicy: TEST_RETENTION_POLICY,
  });

  return {
    advanceBy(durationMs: number) {
      nowMs += durationMs;
    },
    store,
  };
}

function expectStoreSuccess(result: MultiplayerRoomStoreResult) {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.snapshot;
}

function expectStoreFailure(
  result: MultiplayerRoomStoreResult,
  code: Extract<MultiplayerRoomStoreResult, { success: false }>["code"],
) {
  expect(result).toMatchObject({
    code,
    success: false,
  });
}

function createRoom(
  store: InProcessMultiplayerRoomStore,
  settings: { gameId: "pong" | "snake" } = { gameId: "snake" },
) {
  return expectStoreSuccess(
    store.createRoom({
      host: HOST_USER,
      seats: PARTY_SEATS,
      settings,
    }),
  );
}

function createStartedRoom(store: InProcessMultiplayerRoomStore) {
  const created = createRoom(store);

  expectStoreSuccess(
    store.applyCommand(created.room.code, {
      displayName: "Grace Guest",
      type: "room.joinPlayer",
    }),
  );

  return expectStoreSuccess(
    store.applyCommand(created.room.code, {
      command: "start",
      participantId: created.room.hostParticipantId,
      matchId: 1,
      type: "room.lifecycle",
    }),
  );
}

function finishRoom(
  store: InProcessMultiplayerRoomStore,
  roomCode = "ROOM1",
  participantId = "host-1",
) {
  return expectStoreSuccess(
    store.applyCommand(roomCode, {
      command: "finish",
      participantId,
      matchId: 1,
      type: "room.lifecycle",
    }),
  );
}

function createStartedPongRoom(store: InProcessMultiplayerRoomStore) {
  const created = expectStoreSuccess(
    store.createRoom({
      host: HOST_USER,
      settings: {
        gameId: "pong",
        parameters: {
          "pong-board-size": "240x320",
          "pong-target": "1",
        },
      },
    }),
  );

  expectStoreSuccess(
    store.applyCommand(created.room.code, {
      displayName: "Grace Guest",
      type: "room.joinObserver",
    }),
  );
  expectStoreSuccess(
    store.applyCommand(created.room.code, {
      participantId: "host-1",
      seatId: "left",
      matchId: 1,
      type: "room.claimSeat",
    }),
  );
  expectStoreSuccess(
    store.applyCommand(created.room.code, {
      participantId: "guest-1",
      seatId: "right",
      matchId: 1,
      type: "room.claimSeat",
    }),
  );

  return expectStoreSuccess(
    store.applyCommand(created.room.code, {
      command: "start",
      participantId: "host-1",
      matchId: 1,
      type: "room.lifecycle",
    }),
  );
}

function expectPongGame(snapshot: MultiplayerRoomSnapshot) {
  expect(snapshot.game?.gameId).toBe("pong");

  return snapshot.game as PongMultiplayerGameSnapshot;
}

describe("in-process multiplayer room retention", () => {
  it("rejects invalid capacity and retention configuration", () => {
    expect(
      () =>
        new InProcessMultiplayerRoomStore({
          maxRooms: 0,
        }),
    ).toThrow("Room capacity must be a positive integer");
    expect(
      () =>
        new InProcessMultiplayerRoomStore({
          retentionPolicy: {
            terminalTtlMs: 0,
          },
        }),
    ).toThrow("Terminal room TTL must be a positive integer");
  });

  it("expires an inactive lobby after sixty minutes without letting passive reads refresh it", () => {
    const fixture = createRetentionStore();

    createRoom(fixture.store);
    fixture.advanceBy(30 * MINUTE_MS);
    expectStoreSuccess(fixture.store.getRoom("ROOM1"));
    fixture.advanceBy(30 * MINUTE_MS - 1);
    expectStoreSuccess(fixture.store.getRoom("ROOM1"));
    fixture.advanceBy(1);

    expectStoreFailure(fixture.store.getRoom("ROOM1"), "room-expired");
  });

  it("refreshes lobby inactivity only after a successful state-mutating command", () => {
    const fixture = createRetentionStore();

    createRoom(fixture.store);
    fixture.advanceBy(50 * MINUTE_MS);
    expectStoreFailure(
      fixture.store.applyCommand("ROOM1", {
        participantId: "missing-participant",
        seatId: "missing-seat",
        matchId: 1,
        type: "room.claimSeat",
      }),
      "participant-not-found",
    );
    fixture.advanceBy(10 * MINUTE_MS);
    expectStoreFailure(fixture.store.getRoom("ROOM1"), "room-expired");

    const touchedFixture = createRetentionStore();

    createRoom(touchedFixture.store);
    touchedFixture.advanceBy(50 * MINUTE_MS);
    expectStoreSuccess(
      touchedFixture.store.applyCommand("ROOM1", {
        displayName: "Grace Guest",
        type: "room.joinObserver",
      }),
    );
    touchedFixture.advanceBy(60 * MINUTE_MS - 1);
    expectStoreSuccess(touchedFixture.store.getRoom("ROOM1"));
    touchedFixture.advanceBy(1);
    expectStoreFailure(touchedFixture.store.getRoom("ROOM1"), "room-expired");
  });

  it("expires disconnected running and paused rooms after two hours", () => {
    for (const status of ["running", "paused"] as const) {
      const fixture = createRetentionStore();
      const started = createStartedRoom(fixture.store);

      if (status === "paused") {
        expectStoreSuccess(
          fixture.store.applyCommand(started.room.code, {
            command: "pause",
            participantId: started.room.hostParticipantId,
            matchId: 1,
            type: "room.lifecycle",
          }),
        );
      }

      fixture.advanceBy(120 * MINUTE_MS - 1);
      expectStoreSuccess(fixture.store.getRoom(started.room.code));
      fixture.advanceBy(1);
      expectStoreFailure(fixture.store.getRoom(started.room.code), "room-expired");
    }
  });

  it("protects recognized participant connections and starts a full grace after the last disconnect", () => {
    const fixture = createRetentionStore();
    const started = createStartedRoom(fixture.store);

    expect(
      fixture.store.registerParticipantConnection(
        started.room.code,
        started.room.hostParticipantId,
      ),
    ).toBe(true);
    expect(
      fixture.store.registerParticipantConnection(
        started.room.code,
        started.room.hostParticipantId,
      ),
    ).toBe(true);
    fixture.advanceBy(4 * 60 * MINUTE_MS);
    expectStoreSuccess(fixture.store.getRoom(started.room.code));

    fixture.store.unregisterParticipantConnection(
      started.room.code,
      started.room.hostParticipantId,
    );
    fixture.advanceBy(120 * MINUTE_MS);
    expectStoreSuccess(fixture.store.getRoom(started.room.code));

    fixture.store.unregisterParticipantConnection(
      started.room.code,
      started.room.hostParticipantId,
    );
    fixture.advanceBy(120 * MINUTE_MS - 1);
    expectStoreSuccess(fixture.store.getRoom(started.room.code));
    fixture.advanceBy(1);
    expectStoreFailure(fixture.store.getRoom(started.room.code), "room-expired");
  });

  it("does not protect anonymous or invalid participant connections", () => {
    const fixture = createRetentionStore();

    createRoom(fixture.store);
    expect(fixture.store.registerParticipantConnection("ROOM1", undefined)).toBe(false);
    expect(
      fixture.store.registerParticipantConnection("ROOM1", "missing-participant"),
    ).toBe(false);
    fixture.advanceBy(60 * MINUTE_MS);

    expectStoreFailure(fixture.store.getRoom("ROOM1"), "room-expired");
  });

  it("expires explicitly finished rooms after thirty minutes and clears terminal retention on restart", () => {
    const fixture = createRetentionStore();

    createStartedRoom(fixture.store);
    finishRoom(fixture.store);
    fixture.advanceBy(30 * MINUTE_MS - 1);
    expectStoreSuccess(fixture.store.getRoom("ROOM1"));
    fixture.advanceBy(1);
    expectStoreFailure(fixture.store.getRoom("ROOM1"), "room-expired");

    const restartedFixture = createRetentionStore();

    createStartedRoom(restartedFixture.store);
    finishRoom(restartedFixture.store);
    restartedFixture.advanceBy(20 * MINUTE_MS);
    expectStoreSuccess(
      restartedFixture.store.applyCommand("ROOM1", {
        command: "restart",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );
    restartedFixture.advanceBy(30 * MINUTE_MS);
    expectStoreSuccess(restartedFixture.store.getRoom("ROOM1"));
  });

  it("gives long-connected terminal rooms a full thirty-minute grace after disconnect", () => {
    const fixture = createRetentionStore();

    createStartedRoom(fixture.store);
    finishRoom(fixture.store);
    expect(fixture.store.registerParticipantConnection("ROOM1", "host-1")).toBe(
      true,
    );
    fixture.advanceBy(90 * MINUTE_MS);
    expectStoreSuccess(fixture.store.getRoom("ROOM1"));
    fixture.store.unregisterParticipantConnection("ROOM1", "host-1");
    fixture.advanceBy(30 * MINUTE_MS - 1);
    expectStoreSuccess(fixture.store.getRoom("ROOM1"));
    fixture.advanceBy(1);
    expectStoreFailure(fixture.store.getRoom("ROOM1"), "room-expired");
  });

  it("classifies natural adapter terminal state without misclassifying ready or paused games", () => {
    const readyFixture = createRetentionStore();
    const started = createStartedPongRoom(readyFixture.store);

    expectPongGame(started);

    readyFixture.advanceBy(30 * MINUTE_MS);
    expectStoreSuccess(readyFixture.store.getRoom("ROOM1"));

    const pausedFixture = createRetentionStore();

    createStartedPongRoom(pausedFixture.store);

    expectStoreSuccess(
      pausedFixture.store.applyCommand("ROOM1", {
        command: "pause",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );
    pausedFixture.advanceBy(30 * MINUTE_MS);
    expectStoreSuccess(pausedFixture.store.getRoom("ROOM1"));

    const terminalFixture = createRetentionStore();
    const terminalStarted = createStartedPongRoom(terminalFixture.store);

    const serveSide = expectPongGame(terminalStarted).snapshot.serveSide;
    const receivingParticipantId =
      serveSide === "left" ? "guest-1" : "host-1";

    expectStoreSuccess(
      terminalFixture.store.applyCommand("ROOM1", {
        input: {
          direction: "up",
          type: "pong.setPaddleDirection",
        },
        participantId: receivingParticipantId,
        matchId: 1,
        type: "game.input",
      }),
    );
    terminalFixture.advanceBy(getPongTickDelay() * 20);
    expectStoreSuccess(terminalFixture.store.getRoom("ROOM1"));

    expectStoreSuccess(
      terminalFixture.store.applyCommand("ROOM1", {
        input: { type: "pong.serve" },
        participantId: serveSide === "left" ? "host-1" : "guest-1",
        matchId: 1,
        type: "game.input",
      }),
    );

    let terminal = expectStoreSuccess(terminalFixture.store.getRoom("ROOM1"));

    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (["lost", "won"].includes(expectPongGame(terminal).snapshot.status)) {
        break;
      }

      terminalFixture.advanceBy(getPongTickDelay() * 10);
      terminal = expectStoreSuccess(terminalFixture.store.getRoom("ROOM1"));
    }

    expect(["lost", "won"]).toContain(expectPongGame(terminal).snapshot.status);
    expect(terminal.room.status).toBe("finished");
    terminalFixture.advanceBy(30 * MINUTE_MS - 1);
    expectStoreSuccess(terminalFixture.store.getRoom("ROOM1"));
    terminalFixture.advanceBy(1);
    expectStoreFailure(terminalFixture.store.getRoom("ROOM1"), "room-expired");
  });

  it("sweeps expired rooms explicitly and keeps a five-minute expired tombstone", () => {
    const fixture = createRetentionStore();

    createRoom(fixture.store);
    fixture.advanceBy(60 * MINUTE_MS);
    expect(fixture.store.sweepExpiredRooms()).toBe(1);
    expectStoreFailure(fixture.store.getRoom("ROOM1"), "room-expired");
    fixture.advanceBy(5 * MINUTE_MS - 1);
    expectStoreFailure(fixture.store.getRoom("ROOM1"), "room-expired");
    fixture.advanceBy(1);
    expectStoreFailure(fixture.store.getRoom("ROOM1"), "room-not-found");
  });

  it("evicts expired rooms before capacity candidates", () => {
    const fixture = createRetentionStore({ maxRooms: 1 });

    createRoom(fixture.store);
    fixture.advanceBy(60 * MINUTE_MS);
    const second = createRoom(fixture.store);

    expect(second.room.code).toBe("ROOM2");
    expectStoreFailure(fixture.store.getRoom("ROOM1"), "room-expired");
  });

  it("evicts disconnected terminal rooms before lobby rooms at capacity", () => {
    const fixture = createRetentionStore({ maxRooms: 2 });

    createRoom(fixture.store);
    fixture.advanceBy(1);
    const started = createStartedRoom(fixture.store);

    finishRoom(
      fixture.store,
      started.room.code,
      started.room.hostParticipantId,
    );
    fixture.advanceBy(1);
    const third = createRoom(fixture.store);

    expect(third.room.code).toBe("ROOM3");
    expectStoreSuccess(fixture.store.getRoom("ROOM1"));
    expectStoreFailure(fixture.store.getRoom("ROOM2"), "room-expired");
  });

  it("evicts the oldest idle lobby while preserving a recently active lobby", () => {
    const fixture = createRetentionStore({ maxRooms: 2 });

    createRoom(fixture.store);
    fixture.advanceBy(1);
    createRoom(fixture.store);
    fixture.advanceBy(1);
    expectStoreSuccess(
      fixture.store.applyCommand("ROOM1", {
        displayName: "Grace Guest",
        type: "room.joinObserver",
      }),
    );
    createRoom(fixture.store);

    expectStoreSuccess(fixture.store.getRoom("ROOM1"));
    expectStoreFailure(fixture.store.getRoom("ROOM2"), "room-expired");
    expectStoreSuccess(fixture.store.getRoom("ROOM3"));
  });

  it("never capacity-evicts running or recognized-connected rooms", () => {
    const runningFixture = createRetentionStore({ maxRooms: 1 });

    createStartedRoom(runningFixture.store);
    expectStoreFailure(
      runningFixture.store.createRoom({
        host: HOST_USER,
        seats: PARTY_SEATS,
        settings: { gameId: "snake" },
      }),
      "room-capacity-reached",
    );
    expectStoreSuccess(runningFixture.store.getRoom("ROOM1"));

    const pausedFixture = createRetentionStore({ maxRooms: 1 });
    const pausedRoom = createStartedRoom(pausedFixture.store);

    expectStoreSuccess(
      pausedFixture.store.applyCommand(pausedRoom.room.code, {
        command: "pause",
        participantId: pausedRoom.room.hostParticipantId,
        matchId: 1,
        type: "room.lifecycle",
      }),
    );
    expectStoreFailure(
      pausedFixture.store.createRoom({
        host: HOST_USER,
        seats: PARTY_SEATS,
        settings: { gameId: "snake" },
      }),
      "room-capacity-reached",
    );
    expectStoreSuccess(pausedFixture.store.getRoom("ROOM1"));

    const connectedFixture = createRetentionStore({ maxRooms: 1 });

    createRoom(connectedFixture.store);
    expect(
      connectedFixture.store.registerParticipantConnection("ROOM1", "host-1"),
    ).toBe(true);
    expectStoreFailure(
      connectedFixture.store.createRoom({
        host: HOST_USER,
        seats: PARTY_SEATS,
        settings: { gameId: "snake" },
      }),
      "room-capacity-reached",
    );
    expectStoreSuccess(connectedFixture.store.getRoom("ROOM1"));
  });

  it("bounds expired tombstones to room capacity", () => {
    const fixture = createRetentionStore({ maxRooms: 1 });

    createRoom(fixture.store);
    createRoom(fixture.store);
    createRoom(fixture.store);

    expectStoreFailure(fixture.store.getRoom("ROOM1"), "room-not-found");
    expectStoreFailure(fixture.store.getRoom("ROOM2"), "room-expired");
    expectStoreSuccess(fixture.store.getRoom("ROOM3"));
  });

  it("does not evict a valid room for an invalid create request", () => {
    const fixture = createRetentionStore({ maxRooms: 1 });

    createRoom(fixture.store);
    expectStoreFailure(
      fixture.store.createRoom({
        host: {
          displayName: "",
          id: "invalid-user",
        },
        seats: PARTY_SEATS,
        settings: { gameId: "snake" },
      }),
      "invalid-host",
    );
    expectStoreSuccess(fixture.store.getRoom("ROOM1"));
  });

  it("keeps tombstoned room codes unavailable without evicting a live room", () => {
    const fixture = createRetentionStore({
      maxRooms: 1,
      roomCodes: ["ROOM1", "ROOM2", "ROOM1"],
    });

    createRoom(fixture.store);
    createRoom(fixture.store);
    expectStoreFailure(
      fixture.store.createRoom({
        host: HOST_USER,
        seats: PARTY_SEATS,
        settings: { gameId: "snake" },
      }),
      "duplicate-room",
    );
    expectStoreSuccess(fixture.store.getRoom("ROOM2"));
  });

  it("maps expiry and capacity failures to retry-safe HTTP statuses", () => {
    expect(getMultiplayerRoomStoreErrorStatus("room-expired")).toBe(410);
    expect(getMultiplayerRoomStoreErrorStatus("room-capacity-reached")).toBe(503);
  });
});
