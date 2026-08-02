import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_ASTEROIDS_PRIVATE_ROOM_SEATS,
  DEFAULT_PONG_PRIVATE_ROOM_SEATS,
  DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SEATS,
  InProcessMultiplayerRoomStore,
  PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
  type MultiplayerRoomSnapshot,
  type MultiplayerRoomStoreResult,
} from "./multiplayer-room-runtime";
import { getAsteroidsTickDelay } from "../asteroids-game-engine";
import type {
  AsteroidsMultiplayerGameSnapshot,
  AsteroidsMultiplayerGameState,
} from "../asteroids-multiplayer";
import type { PrivateRoomSettings } from "../multiplayer/room";
import {
  getPongMaximumScore,
  getPongScoreTickDelay,
  getPongTickDelay,
} from "../pong-game-engine";
import type { PongMultiplayerGameSnapshot } from "../pong-multiplayer";
import { getSpaceInvadersTickDelay } from "../space-invaders-game-engine";
import { asteroidsMultiplayerRuntimeAdapter } from "./asteroids-multiplayer-game-adapter";
import type { SpaceInvadersMultiplayerServerGameSnapshot } from "./multiplayer-game-adapters";

const HOST_USER = {
  displayName: "Ada Host",
  id: "user-1",
};

function createTestRoomStore({
  getNowMs,
  participantCapabilities = [
    "host-capability",
    "guest-capability",
    "guest-two-capability",
    "observer-capability",
  ],
  participantIds = ["host-1", "guest-1", "guest-2", "observer-1"],
  roomCodes = ["ROOM1"],
}: {
  getNowMs?: () => number;
  participantCapabilities?: string[];
  participantIds?: string[];
  roomCodes?: string[];
} = {}) {
  let participantCapabilityIndex = 0;
  let participantIdIndex = 0;
  let roomCodeIndex = 0;
  const capabilityOptions = {
    createParticipantCapability: () =>
      participantCapabilities[participantCapabilityIndex++] ??
      `participant-capability-${participantCapabilityIndex}`,
  };

  return new InProcessMultiplayerRoomStore({
    ...capabilityOptions,
    createParticipantId: ({ role }) =>
      participantIds[participantIdIndex++] ?? `${role}-${participantIdIndex}`,
    createRoomCode: () => roomCodes[roomCodeIndex++] ?? "ROOM-FALLBACK",
    getNowMs,
  });
}

function expectStoreSuccess(result: MultiplayerRoomStoreResult) {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.snapshot;
}

function expectPongGame(snapshot: MultiplayerRoomSnapshot) {
  expect(snapshot.game?.gameId).toBe("pong");

  return snapshot.game as PongMultiplayerGameSnapshot;
}

function expectAsteroidsGame(snapshot: MultiplayerRoomSnapshot) {
  expect(snapshot.game?.gameId).toBe("asteroids");

  return snapshot.game as AsteroidsMultiplayerGameSnapshot;
}

function expectSpaceInvadersGame(snapshot: MultiplayerRoomSnapshot) {
  expect(snapshot.game?.gameId).toBe("space-invaders");

  return snapshot.game as SpaceInvadersMultiplayerServerGameSnapshot;
}

function createStartedPongRoom(
  store: InProcessMultiplayerRoomStore,
  settings: PrivateRoomSettings = { gameId: "pong" },
) {
  expectStoreSuccess(store.createRoom({ host: HOST_USER, settings }));
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      displayName: "Guest One",
      type: "room.joinObserver",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "host-1",
      seatId: "left",
      matchId: 1,
      type: "room.claimSeat",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "guest-1",
      seatId: "right",
      matchId: 1,
      type: "room.claimSeat",
    }),
  );

  return expectStoreSuccess(
    store.applyCommand("ROOM1", {
      command: "start",
      participantId: "host-1",
      matchId: 1,
      type: "room.lifecycle",
    }),
  );
}

function createStartedSpaceInvadersRoom(
  store: InProcessMultiplayerRoomStore,
  settings: PrivateRoomSettings = { gameId: "space-invaders" },
) {
  expectStoreSuccess(
    store.createRoom({
      host: HOST_USER,
      settings,
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      displayName: "Guest One",
      type: "room.joinObserver",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "host-1",
      seatId: "ship-a",
      matchId: 1,
      type: "room.claimSeat",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "guest-1",
      seatId: "ship-b",
      matchId: 1,
      type: "room.claimSeat",
    }),
  );

  return expectStoreSuccess(
    store.applyCommand("ROOM1", {
      command: "start",
      participantId: "host-1",
      matchId: 1,
      type: "room.lifecycle",
    }),
  );
}

function createStartedAsteroidsRoom(
  store: InProcessMultiplayerRoomStore,
  settings: PrivateRoomSettings = { gameId: "asteroids" },
) {
  expectStoreSuccess(
    store.createRoom({
      host: HOST_USER,
      settings,
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      displayName: "Guest One",
      type: "room.joinObserver",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "host-1",
      seatId: "ship-a",
      matchId: 1,
      type: "room.claimSeat",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "guest-1",
      seatId: "ship-b",
      matchId: 1,
      type: "room.claimSeat",
    }),
  );

  return expectStoreSuccess(
    store.applyCommand("ROOM1", {
      command: "start",
      participantId: "host-1",
      matchId: 1,
      type: "room.lifecycle",
    }),
  );
}

function serveStartedPongRoom(store: InProcessMultiplayerRoomStore) {
  const snapshot = expectStoreSuccess(store.getRoom("ROOM1"));
  const serveSide = expectPongGame(snapshot).snapshot.serveSide;

  return expectStoreSuccess(
    store.applyCommand("ROOM1", {
      input: {
        type: "pong.serve",
      },
      participantId: serveSide === "left" ? "host-1" : "guest-1",
      matchId: 1,
      type: "game.input",
    }),
  );
}

function getPongParticipantIdForSide(side: "left" | "right") {
  return side === "left" ? "host-1" : "guest-1";
}

function getTerminalPongStatusForServeSide(serveSide: "left" | "right") {
  return serveSide === "left" ? "won" : "lost";
}

describe("in-process multiplayer room store", () => {
  it("scopes match commands to the active generation before advancing runtime", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    const started = createStartedPongRoom(store);

    expect(started.room.matchId).toBe(1);
    expect(expectPongGame(started).matchId).toBe(1);

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "up",
          type: "pong.setPaddleDirection",
        },
        matchId: 1,
        participantId: "host-1",
        type: "game.input",
      }),
    );
    const restarted = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "restart",
        matchId: 1,
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );
    const restartedGame = expectPongGame(restarted);

    expect(restarted.room.matchId).toBe(2);
    expect(restartedGame).toMatchObject({
      heldInputs: {},
      matchId: 2,
      seq: 1,
    });

    nowMs += getPongTickDelay() * 3;

    const staleCommands = [
      {
        matchId: 1,
        participantId: "host-1",
        seatId: "left",
        type: "room.claimSeat" as const,
      },
      {
        matchId: 1,
        participantId: "host-1",
        seatId: "left",
        type: "room.releaseSeat" as const,
      },
      {
        command: "pause" as const,
        matchId: 1,
        participantId: "host-1",
        type: "room.lifecycle" as const,
      },
      {
        matchId: 1,
        participantId: "host-1",
        settings: { gameId: "pong" as const },
        type: "room.replaceMatch" as const,
      },
      {
        matchId: 1,
        participantId: "host-1",
        settings: { gameId: "pong" as const },
        type: "room.updateSettings" as const,
      },
      {
        gameId: "pong" as const,
        input: {
          direction: "down",
          type: "pong.setPaddleDirection",
        },
        matchId: 1,
        participantId: "host-1",
        type: "game.input" as const,
      },
    ];

    for (const command of staleCommands) {
      expect(store.applyCommand("ROOM1", command)).toEqual({
        code: "stale-match",
        error: "Command belongs to an earlier match. Refresh the party and try again.",
        success: false,
      });
    }

    nowMs = 1_000;
    const unchanged = expectStoreSuccess(store.getRoom("ROOM1"));

    expect(unchanged.seq).toBe(restarted.seq);
    expect(unchanged.room).toEqual(restarted.room);
    expect(expectPongGame(unchanged)).toEqual(restartedGame);
  });

  it("mints opaque participant capabilities without publishing them in snapshots", () => {
    const store = createTestRoomStore();
    const created = store.createRoom({ host: HOST_USER });

    expect(created).toMatchObject({
      participantCapability: "host-capability",
      success: true,
    });

    if (!created.success) {
      throw new Error(created.error);
    }

    expect(created.snapshot).not.toHaveProperty("participantCapability");

    const joined = store.applyCommand("ROOM1", {
      displayName: "Guest One",
      type: "room.joinObserver",
    });

    expect(joined).toMatchObject({
      participantCapability: "guest-capability",
      success: true,
    });

    if (!joined.success) {
      throw new Error(joined.error);
    }

    expect(joined.snapshot).not.toHaveProperty("participantCapability");
    expect(expectStoreSuccess(store.getRoom("ROOM1"))).not.toHaveProperty(
      "participantCapability",
    );

    const capabilityStore = store as InProcessMultiplayerRoomStore & {
      resolveParticipantCapability: (
        roomCode: unknown,
        participantCapability: unknown,
      ) => string | null;
    };

    expect(capabilityStore.resolveParticipantCapability).toEqual(
      expect.any(Function),
    );
    expect(
      capabilityStore.resolveParticipantCapability("ROOM1", "host-capability"),
    ).toBe("host-1");
    expect(
      capabilityStore.resolveParticipantCapability("ROOM1", "guest-capability"),
    ).toBe("guest-1");
    expect(
      capabilityStore.resolveParticipantCapability("ROOM1", "wrong-capability"),
    ).toBeNull();
  });

  it("creates signed-in host rooms with deterministic ids and default Pong seats", () => {
    const store = createTestRoomStore();
    const snapshot = expectStoreSuccess(store.createRoom({ host: HOST_USER }));

    expect(snapshot).toEqual({
      participant: {
        displayName: "Ada Host",
        id: "host-1",
        role: "host",
        userId: "user-1",
      },
      room: {
        code: "ROOM1",
        hostParticipantId: "host-1",
        matchId: 1,
        participants: [
          {
            displayName: "Ada Host",
            id: "host-1",
            role: "host",
            userId: "user-1",
          },
        ],
        seats: DEFAULT_PONG_PRIVATE_ROOM_SEATS.map((seat, index) => ({
          ...seat,
          occupiedByParticipantId: index === 0 ? "host-1" : null,
        })),
        settings: {
          gameId: "pong",
        },
        status: "lobby",
      },
      seq: 1,
    });
  });

  it("creates Space Invaders rooms with default ship seats", () => {
    const store = createTestRoomStore();
    const snapshot = expectStoreSuccess(
      store.createRoom({
        host: HOST_USER,
        settings: { gameId: "space-invaders" },
      }),
    );

    expect(snapshot.room).toMatchObject({
      code: "ROOM1",
      seats: DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SEATS.map((seat, index) => ({
        ...seat,
        occupiedByParticipantId: index === 0 ? "host-1" : null,
      })),
      settings: {
        gameId: "space-invaders",
      },
      status: "lobby",
    });
  });

  it("creates Asteroids rooms with default ship seats", () => {
    const store = createTestRoomStore();
    const snapshot = expectStoreSuccess(
      store.createRoom({
        host: HOST_USER,
        settings: { gameId: "asteroids" },
      }),
    );

    expect(snapshot.room).toMatchObject({
      code: "ROOM1",
      seats: DEFAULT_ASTEROIDS_PRIVATE_ROOM_SEATS.map((seat, index) => ({
        ...seat,
        occupiedByParticipantId: index === 0 ? "host-1" : null,
      })),
      settings: {
        gameId: "asteroids",
      },
      status: "lobby",
    });
  });

  it("admits a guest player into the open slot with one command", () => {
    const store = createTestRoomStore();

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));
    const result = store.applyCommand("ROOM1", {
      displayName: "Guest Player",
      type: "room.joinPlayer",
    });
    const snapshot = expectStoreSuccess(result);

    expect(result).toMatchObject({
      participantCapability: "guest-capability",
      success: true,
    });
    expect(snapshot.participant).toMatchObject({
      displayName: "Guest Player",
      id: "guest-1",
      role: "player",
    });
    expect(snapshot.room.seats.map((seat) => seat.occupiedByParticipantId)).toEqual([
      "host-1",
      "guest-1",
    ]);
  });

  it("reports the accepted observer role when an active-match play join falls back", () => {
    const participantRoles: string[] = [];
    const capabilityRoles: string[] = [];
    const participantIds = ["host-1", "guest-1", "guest-2"];
    let participantIndex = 0;
    const store = new InProcessMultiplayerRoomStore({
      createParticipantCapability: ({ role }) => {
        capabilityRoles.push(role);
        return `capability-${capabilityRoles.length}`;
      },
      createParticipantId: ({ role }) => {
        participantRoles.push(role);
        return participantIds[participantIndex++] ?? `participant-${participantIndex}`;
      },
      createRoomCode: () => "ROOM1",
    });

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest Player",
        type: "room.joinPlayer",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "start",
        matchId: 1,
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );
    const fallback = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Late Guest",
        type: "room.joinPlayer",
      }),
    );

    expect(fallback.participant).toMatchObject({
      id: "guest-2",
      role: "observer",
    });
    expect(participantRoles).toEqual(["host", "player", "observer"]);
    expect(capabilityRoles).toEqual(["host", "player", "observer"]);
  });

  it("atomically replaces a finished match while retaining players and rejecting stale input", () => {
    const store = createTestRoomStore();

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest Player",
        type: "room.joinPlayer",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "start",
        matchId: 1,
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "finish",
        matchId: 1,
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );

    const replaced = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        matchId: 1,
        participantId: "host-1",
        settings: {
          gameId: "asteroids",
          parameters: { "asteroids-difficulty": "hard" },
        },
        type: "room.replaceMatch",
      }),
    );

    expect(replaced).toMatchObject({
      room: {
        code: "ROOM1",
        hostParticipantId: "host-1",
        matchId: 2,
        participants: [
          expect.objectContaining({ id: "host-1", role: "host" }),
          expect.objectContaining({ id: "guest-1", role: "player" }),
        ],
        seats: [
          expect.objectContaining({
            id: "ship-a",
            occupiedByParticipantId: "host-1",
          }),
          expect.objectContaining({
            id: "ship-b",
            occupiedByParticipantId: "guest-1",
          }),
        ],
        settings: {
          gameId: "asteroids",
          parameters: { "asteroids-difficulty": "hard" },
        },
        status: "lobby",
      },
      seq: 5,
    });
    expect(replaced.game).toBeUndefined();

    expect(
      store.applyCommand("ROOM1", {
        gameId: "pong",
        input: { direction: "up", type: "pong.setPaddleDirection" },
        matchId: 1,
        participantId: "host-1",
        type: "game.input",
      }),
    ).toEqual({
      code: "stale-match",
      error: "Command belongs to an earlier match. Refresh the party and try again.",
      success: false,
    });
    expect(expectStoreSuccess(store.getRoom("ROOM1"))).toEqual({
      room: replaced.room,
      seq: replaced.seq,
    });
  });

  it("leaves the current match unchanged when replacement is unsupported", () => {
    const store = createTestRoomStore();
    const before = expectStoreSuccess(store.createRoom({ host: HOST_USER }));

    expect(
      store.applyCommand("ROOM1", {
        matchId: 1,
        participantId: "host-1",
        settings: { gameId: "snake" },
        type: "room.replaceMatch",
      }),
    ).toEqual({
      code: "invalid-room-settings",
      error: "Selected game does not support multiplayer.",
      success: false,
    });
    expect(expectStoreSuccess(store.getRoom("ROOM1"))).toEqual({
      room: before.room,
      seq: before.seq,
    });
  });

  it("reports duplicate generated codes and unknown rooms", () => {
    const store = createTestRoomStore({
      participantIds: ["host-1", "host-2"],
      roomCodes: ["ROOM1", "room1"],
    });

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));

    expect(store.createRoom({ host: HOST_USER })).toEqual({
      code: "duplicate-room",
      error: "Room code is already in use.",
      success: false,
    });
    expect(store.getRoom("missing")).toEqual({
      code: "room-not-found",
      error: "Room was not found.",
      success: false,
    });
    expect(store.getRoom("bad room")).toEqual({
      code: "invalid-room-code",
      error: "Room code is not supported.",
      success: false,
    });
  });

  it("allows guest observers to join running rooms without changing occupied seats", () => {
    const store = createTestRoomStore();

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest One",
        type: "room.joinObserver",
      }),
    );
    const seatedRoom = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "right",
        matchId: 1,
        type: "room.claimSeat",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );
    const observedRoom = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Late Observer",
        type: "room.joinObserver",
      }),
    );

    expect(observedRoom.room.status).toBe("running");
    expect(observedRoom.room.seats).toEqual(seatedRoom.room.seats);
    expect(observedRoom.participant).toEqual({
      displayName: "Late Observer",
      id: "guest-2",
      role: "observer",
      userId: null,
    });
  });

  it("applies seat commands while preserving host authority", () => {
    const store = createTestRoomStore();

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));
    const guestSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest One",
        type: "room.joinObserver",
      }),
    );
    const seatedGuestSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "right",
        matchId: 1,
        type: "room.claimSeat",
      }),
    );
    const releasedGuestSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "right",
        matchId: 1,
        type: "room.releaseSeat",
      }),
    );
    const seatedHostSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "left",
        matchId: 1,
        type: "room.claimSeat",
      }),
    );

    expect(guestSnapshot.participant?.role).toBe("observer");
    expect(seatedGuestSnapshot.participant?.role).toBe("player");
    expect(seatedGuestSnapshot.room.seats[1]?.occupiedByParticipantId).toBe("guest-1");
    expect(releasedGuestSnapshot.participant?.role).toBe("observer");
    expect(releasedGuestSnapshot.room.seats[1]?.occupiedByParticipantId).toBeNull();
    expect(seatedHostSnapshot.participant).toMatchObject({
      id: "host-1",
      role: "host",
      userId: "user-1",
    });
  });

  it("keeps settings and lifecycle commands host-only", () => {
    const store = createTestRoomStore();

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest One",
        type: "room.joinObserver",
      }),
    );

    expect(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        settings: {
          gameId: "pong",
          parameters: {
            targetScore: 7,
          },
        },
        matchId: 1,
        type: "room.updateSettings",
      }),
    ).toEqual({
      code: "not-host",
      error: "Only the signed-in room host can perform this action.",
      success: false,
    });
    expect(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "guest-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    ).toEqual({
      code: "not-host",
      error: "Only the signed-in room host can perform this action.",
      success: false,
    });

    const updatedSettings = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        settings: {
          gameId: "pong",
          parameters: {
            targetScore: 7,
          },
        },
        matchId: 1,
        type: "room.updateSettings",
      }),
    );

    expect(updatedSettings.room.settings).toEqual({
      gameId: "pong",
      parameters: {
        targetScore: 7,
      },
    });
    expect(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    ).toMatchObject({
      code: "required-seats-empty",
      success: false,
    });
  });

  it("initializes Pong game snapshots only when a full room starts", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest One",
        type: "room.joinObserver",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "left",
        matchId: 1,
        type: "room.claimSeat",
      }),
    );

    expect(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    ).toMatchObject({
      code: "required-seats-empty",
      success: false,
    });
    expect(expectStoreSuccess(store.getRoom("ROOM1")).game).toBeUndefined();

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "right",
        matchId: 1,
        type: "room.claimSeat",
      }),
    );

    nowMs = 1_500;
    const started = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );

    expect(started.game).toMatchObject({
      gameId: "pong",
      heldInputs: {},
      seq: 1,
      serverTimeMs: 1_500,
      snapshot: {
        score: {
          cpu: 0,
          player: 0,
        },
        status: "ready",
      },
    });
  });

  it("initializes Space Invaders only after both ship seats are occupied", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });

    expectStoreSuccess(
      store.createRoom({
        host: HOST_USER,
        settings: { gameId: "space-invaders" },
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest One",
        type: "room.joinObserver",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "ship-a",
        matchId: 1,
        type: "room.claimSeat",
      }),
    );

    expect(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    ).toMatchObject({
      code: "required-seats-empty",
      success: false,
    });
    expect(expectStoreSuccess(store.getRoom("ROOM1")).game).toBeUndefined();

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "ship-b",
        matchId: 1,
        type: "room.claimSeat",
      }),
    );

    nowMs = 1_500;
    const started = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );

    expect(started.room).toMatchObject({
      settings: {
        gameId: "space-invaders",
      },
      status: "running",
    });
    expect(started.game).toMatchObject({
      gameId: "space-invaders",
      heldInputs: {},
      seq: 1,
      serverTimeMs: 1_500,
      snapshot: {
        lives: expect.any(Number),
        score: 0,
        status: "running",
        ships: {
          "ship-a": {
            isActive: true,
            seat: "ship-a",
          },
          "ship-b": {
            isActive: true,
            seat: "ship-b",
          },
        },
      },
    });
  });

  it("initializes Asteroids only after both ship seats are occupied", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });

    expectStoreSuccess(
      store.createRoom({
        host: HOST_USER,
        settings: { gameId: "asteroids" },
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest One",
        type: "room.joinObserver",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "ship-a",
        matchId: 1,
        type: "room.claimSeat",
      }),
    );

    expect(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    ).toMatchObject({
      code: "required-seats-empty",
      success: false,
    });
    expect(expectStoreSuccess(store.getRoom("ROOM1")).game).toBeUndefined();

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "ship-b",
        matchId: 1,
        type: "room.claimSeat",
      }),
    );

    nowMs = 1_500;
    const started = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );

    expect(started.room).toMatchObject({
      settings: {
        gameId: "asteroids",
      },
      status: "running",
    });
    expect(started.game).toMatchObject({
      gameId: "asteroids",
      heldInputs: {},
      seq: 1,
      serverTimeMs: 1_500,
      snapshot: {
        lives: expect.any(Number),
        score: 0,
        status: "running",
        wave: 1,
        ships: {
          "ship-a": {
            isActive: true,
            seat: "ship-a",
          },
          "ship-b": {
            isActive: true,
            seat: "ship-b",
          },
        },
      },
    });
  });

  it("starts and restarts Space Invaders with launcher-style room parameters", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    const started = createStartedSpaceInvadersRoom(store, {
      gameId: "space-invaders",
      parameters: {
        "space-invaders-aliens": "40",
        "space-invaders-board-size": "480x640",
      },
    });
    const startedGame = expectSpaceInvadersGame(started).snapshot;

    expect(startedGame).toMatchObject({
      alienCount: 40,
      boardHeight: 640,
      boardWidth: 480,
      status: "running",
    });
    expect(startedGame.invaders.filter((invader) => invader.isActive)).toHaveLength(
      40,
    );

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "right",
          type: "space-invaders.setShipDirection",
        },
        participantId: "host-1",
        matchId: 1,
        type: "game.input",
      }),
    );
    nowMs += getSpaceInvadersTickDelay();
    const advanced = expectStoreSuccess(store.getRoom("ROOM1"));

    expect(
      expectSpaceInvadersGame(advanced).snapshot.ships["ship-a"].player.x,
    ).toBeGreaterThan(startedGame.ships["ship-a"].player.x);

    const restarted = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "restart",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );
    const restartedGame = expectSpaceInvadersGame(restarted).snapshot;

    expect(restartedGame).toMatchObject({
      alienCount: 40,
      boardHeight: 640,
      boardWidth: 480,
      score: 0,
      status: "running",
    });
    expect(
      restartedGame.invaders.filter((invader) => invader.isActive),
    ).toHaveLength(40);
    expect(restartedGame.ships["ship-a"].player.x).toBe(
      startedGame.ships["ship-a"].player.x,
    );
  });

  it("starts and restarts Asteroids with launcher-style room difficulty", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    const started = createStartedAsteroidsRoom(store, {
      gameId: "asteroids",
      parameters: {
        "asteroids-difficulty": "hard",
      },
    });
    const startedGame = expectAsteroidsGame(started).snapshot;

    expect(startedGame).toMatchObject({
      difficulty: "hard",
      lives: 2,
      score: 0,
      status: "running",
      wave: 1,
    });
    expect(startedGame.asteroids).toHaveLength(5);

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          controls: {
            rotateLeft: false,
            rotateRight: false,
            thrust: true,
          },
          type: "asteroids.setShipControls",
        },
        participantId: "host-1",
        matchId: 1,
        type: "game.input",
      }),
    );
    nowMs += getAsteroidsTickDelay();
    const advanced = expectStoreSuccess(store.getRoom("ROOM1"));

    expect(
      expectAsteroidsGame(advanced).snapshot.ships["ship-a"].ship.y,
    ).toBeLessThan(startedGame.ships["ship-a"].ship.y);

    const restarted = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "restart",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );
    const restartedGame = expectAsteroidsGame(restarted);

    expect(restartedGame.heldInputs).toEqual({});
    expect(restartedGame.snapshot).toMatchObject({
      asteroids: expect.arrayContaining([expect.any(Object)]),
      difficulty: "hard",
      lives: 2,
      score: 0,
      status: "running",
      wave: 1,
    });
    expect(restartedGame.snapshot.asteroids).toHaveLength(5);
    expect(restartedGame.snapshot.ships["ship-a"].bullets).toEqual([]);
    expect(restartedGame.snapshot.ships["ship-b"].bullets).toEqual([]);
  });

  it("maps Pong input participants to seats and advances the matching paddle", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    const started = createStartedPongRoom(store);
    const initialGame = expectPongGame(started).snapshot;
    const inputSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "up",
          type: "pong.setPaddleDirection",
        },
        participantId: "host-1",
        matchId: 1,
        type: "game.input",
      }),
    );

    expect(inputSnapshot.seq).toBe(started.seq);
    expect(inputSnapshot.game?.seq).toBe(started.game!.seq + 1);
    expect(inputSnapshot.game?.heldInputs).toEqual({
      left: {
        up: true,
      },
    });

    nowMs += getPongTickDelay();
    const advanced = expectStoreSuccess(store.getRoom("ROOM1"));
    const advancedPongGame = expectPongGame(advanced).snapshot;

    expect(advanced.game?.heldInputs).toEqual({
      left: {
        up: true,
      },
    });
    expect(advancedPongGame.playerPaddle.y).toBeLessThan(initialGame.playerPaddle.y);
    expect(advancedPongGame.cpuPaddle.y).toBe(initialGame.cpuPaddle.y);
  });

  it("maps Space Invaders input participants to ships and advances held direction", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    const started = createStartedSpaceInvadersRoom(store);
    const initialGame = expectSpaceInvadersGame(started).snapshot;
    const initialShipA = initialGame.ships["ship-a"].player;
    const initialShipB = initialGame.ships["ship-b"].player;

    const inputSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "right",
          type: "space-invaders.setShipDirection",
        },
        participantId: "host-1",
        matchId: 1,
        type: "game.input",
      }),
    );

    expect(inputSnapshot.seq).toBe(started.seq);
    expect(inputSnapshot.game?.seq).toBe(started.game!.seq + 1);
    expect(inputSnapshot.game?.heldInputs).toEqual({
      "ship-a": {
        right: true,
      },
    });

    nowMs += getSpaceInvadersTickDelay();
    const advanced = expectStoreSuccess(store.getRoom("ROOM1"));
    const advancedGame = expectSpaceInvadersGame(advanced).snapshot;

    expect(advanced.game?.heldInputs).toEqual({
      "ship-a": {
        right: true,
      },
    });
    expect(advancedGame.ships["ship-a"].player.x).toBeGreaterThan(initialShipA.x);
    expect(advancedGame.ships["ship-b"].player.x).toBe(initialShipB.x);

    const fired = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          type: "space-invaders.fire",
        },
        participantId: "guest-1",
        matchId: 1,
        type: "game.input",
      }),
    );
    const firedGame = expectSpaceInvadersGame(fired).snapshot;

    expect(firedGame.ships["ship-a"].playerShots).toHaveLength(0);
    expect(firedGame.ships["ship-b"].playerShots).toHaveLength(1);

    expect(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "ship-a",
        matchId: 1,
        type: "room.releaseSeat",
      }),
    ).toEqual({
      code: "invalid-status",
      error: "Player seats can only change between matches.",
      success: false,
    });
  });

  it("maps Asteroids input participants to ships and advances held controls", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    const started = createStartedAsteroidsRoom(store);
    const initialGame = expectAsteroidsGame(started).snapshot;
    const initialShipA = initialGame.ships["ship-a"].ship;
    const initialShipB = initialGame.ships["ship-b"].ship;

    const inputSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          controls: {
            rotateLeft: true,
            rotateRight: false,
            thrust: true,
          },
          type: "asteroids.setShipControls",
        },
        participantId: "host-1",
        matchId: 1,
        type: "game.input",
      }),
    );

    expect(inputSnapshot.seq).toBe(started.seq);
    expect(inputSnapshot.game?.seq).toBe(started.game!.seq + 1);
    expect(inputSnapshot.game?.heldInputs).toEqual({
      "ship-a": {
        rotateLeft: true,
        thrust: true,
      },
    });

    nowMs += getAsteroidsTickDelay();
    const advanced = expectStoreSuccess(store.getRoom("ROOM1"));
    const advancedGame = expectAsteroidsGame(advanced).snapshot;

    expect(advanced.game?.heldInputs).toEqual({
      "ship-a": {
        rotateLeft: true,
        thrust: true,
      },
    });
    expect(advancedGame.ships["ship-a"].ship.angle).not.toBe(initialShipA.angle);
    expect(advancedGame.ships["ship-a"].ship.y).toBeLessThan(initialShipA.y);
    expect(advancedGame.ships["ship-b"].ship.x).toBe(initialShipB.x);
    expect(advancedGame.ships["ship-b"].ship.y).toBe(initialShipB.y);

    const fired = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          type: "asteroids.fire",
        },
        participantId: "guest-1",
        matchId: 1,
        type: "game.input",
      }),
    );
    const firedGame = expectAsteroidsGame(fired).snapshot;

    expect(firedGame.ships["ship-a"].bullets).toHaveLength(0);
    expect(firedGame.ships["ship-b"].bullets).toHaveLength(1);

    expect(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "ship-a",
        matchId: 1,
        type: "room.releaseSeat",
      }),
    ).toEqual({
      code: "invalid-status",
      error: "Player seats can only change between matches.",
      success: false,
    });
  });

  it("adds a server-derived Pong terminal summary to terminal game snapshots", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    const started = createStartedPongRoom(store, {
      gameId: "pong",
      parameters: {
        "pong-board-size": "240x320",
        "pong-target": "1",
      },
    });
    const serveSide = expectPongGame(started).snapshot.serveSide;
    const receivingSide = serveSide === "left" ? "right" : "left";
    const servingParticipantId = getPongParticipantIdForSide(serveSide);

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "up",
          type: "pong.setPaddleDirection",
        },
        participantId: getPongParticipantIdForSide(receivingSide),
        matchId: 1,
        type: "game.input",
      }),
    );

    nowMs += getPongTickDelay() * 20;
    expectStoreSuccess(store.getRoom("ROOM1"));

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          type: "pong.serve",
        },
        participantId: servingParticipantId,
        matchId: 1,
        type: "game.input",
      }),
    );

    let terminal = expectStoreSuccess(store.getRoom("ROOM1"));

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const status = expectPongGame(terminal).snapshot.status;

      if (status === "won" || status === "lost") {
        break;
      }

      nowMs += getPongTickDelay() * 10;
      terminal = expectStoreSuccess(store.getRoom("ROOM1"));
    }

    const terminalGame = expectPongGame(terminal);
    const terminalStatus = getTerminalPongStatusForServeSide(serveSide);

    expect(terminalGame.snapshot.status).toBe(terminalStatus);
    expect(terminalGame.summary).toEqual({
      key: "pong|mode=private-room|board=240x320|target=1",
      mode: "private-room",
      outcome: {
        leftScore: serveSide === "left" ? 1 : 0,
        rightScore: serveSide === "right" ? 1 : 0,
        targetScore: 1,
        winnerParticipantId: servingParticipantId,
        winnerSeatId: serveSide,
      },
      seats: [
        {
          id: "left",
          label: "Left",
          participant: {
            displayName: "Ada Host",
            id: "host-1",
            role: "host",
            userId: "user-1",
          },
        },
        {
          id: "right",
          label: "Right",
          participant: {
            displayName: "Guest One",
            id: "guest-1",
            role: "player",
            userId: null,
          },
        },
      ],
      settings: {
        gameId: "pong",
        parameters: {
          "pong-board-size": "240x320",
          "pong-target": "1",
        },
      },
      status: terminalStatus,
    });
    expect(terminal.room.status).toBe("finished");

    const replaced = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        matchId: terminal.room.matchId,
        participantId: "host-1",
        settings: { gameId: "asteroids" },
        type: "room.replaceMatch",
      }),
    );

    expect(replaced).toMatchObject({
      room: {
        matchId: 2,
        settings: { gameId: "asteroids" },
        status: "lobby",
      },
    });
    expect(replaced.game).toBeUndefined();
  });

  it("adds a server-derived Space Invaders terminal summary to terminal game snapshots", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });

    let terminal = createStartedSpaceInvadersRoom(store, {
      gameId: "space-invaders",
      parameters: {
        "space-invaders-aliens": "24",
        "space-invaders-board-size": "360x480",
      },
    });

    for (let attempt = 0; attempt < 180; attempt += 1) {
      const status = expectSpaceInvadersGame(terminal).snapshot.status;

      if (status === "won" || status === "lost") {
        break;
      }

      nowMs += getSpaceInvadersTickDelay() * 60;
      terminal = expectStoreSuccess(store.getRoom("ROOM1"));
    }

    const terminalGame = expectSpaceInvadersGame(terminal);
    const terminalStatus = terminalGame.snapshot.status;

    expect(["lost", "won"]).toContain(terminalStatus);
    expect(terminalGame.summary).toEqual({
      key: "space-invaders|mode=private-room|board=360x480|aliens=24",
      mode: "private-room",
      outcome: {
        livesRemaining: terminalGame.snapshot.lives,
        remainingInvaders: terminalGame.snapshot.invaders.filter(
          (invader) => invader.isActive,
        ).length,
        result: terminalStatus,
        score: terminalGame.snapshot.score,
      },
      seats: [
        {
          id: "ship-a",
          label: "Ship A",
          participant: {
            displayName: "Ada Host",
            id: "host-1",
            role: "host",
            userId: "user-1",
          },
        },
        {
          id: "ship-b",
          label: "Ship B",
          participant: {
            displayName: "Guest One",
            id: "guest-1",
            role: "player",
            userId: null,
          },
        },
      ],
      settings: {
        gameId: "space-invaders",
        parameters: {
          "space-invaders-aliens": "24",
          "space-invaders-board-size": "360x480",
        },
      },
      status: terminalStatus,
    });
  });

  it("adds a server-derived Asteroids terminal summary to terminal game snapshots", () => {
    const store = createTestRoomStore();
    const started = createStartedAsteroidsRoom(store, {
      gameId: "asteroids",
      parameters: {
        "asteroids-difficulty": "easy",
      },
    });
    const runtimeResult = asteroidsMultiplayerRuntimeAdapter.createRuntime({
      nowMs: 1_000,
      room: started.room,
    });

    expect(runtimeResult.success).toBe(true);

    if (!runtimeResult.success) {
      throw new Error(runtimeResult.error);
    }

    const runtime = runtimeResult.runtime as {
      game: AsteroidsMultiplayerGameState;
    };

    runtime.game = {
      ...runtime.game,
      lives: 0,
      score: 4_200,
      status: "lost",
      wave: 4,
    };

    const terminalGame = asteroidsMultiplayerRuntimeAdapter.createSnapshot({
      room: started.room,
      runtime,
      serverTimeMs: 1_500,
    });

    expect(terminalGame.summary).toEqual({
      key: "asteroids|mode=private-room|difficulty=easy",
      mode: "private-room",
      outcome: {
        livesRemaining: 0,
        score: 4_200,
        wave: 4,
      },
      seats: [
        {
          id: "ship-a",
          label: "Ship A",
          participant: {
            displayName: "Ada Host",
            id: "host-1",
            role: "host",
            userId: "user-1",
          },
        },
        {
          id: "ship-b",
          label: "Ship B",
          participant: {
            displayName: "Guest One",
            id: "guest-1",
            role: "player",
            userId: null,
          },
        },
      ],
      settings: {
        gameId: "asteroids",
        parameters: {
          "asteroids-difficulty": "easy",
        },
      },
      status: "lost",
    });
  });

  it("keeps multiplayer summaries separate from solo result mechanisms", async () => {
    const sources = await Promise.all(
      [
        "src/components/pong-multiplayer-room.tsx",
        "src/components/space-invaders-multiplayer-room.tsx",
        "src/lib/server/asteroids-multiplayer-game-adapter.ts",
        "src/lib/server/multiplayer-game-adapters.ts",
        "src/lib/server/multiplayer-room-runtime.ts",
      ].map((path) => readFile(path, "utf8")),
    );
    const combinedSource = sources.join("\n");

    for (const forbidden of [
      "@/components/game-leaderboard",
      "@/components/game-leaderboard-presenter",
      "@/components/game-replay-save-action",
      "@/hooks/use-game-session",
      "@/lib/leaderboard",
      "@/lib/asteroids-replay",
      "@/lib/pong-replay",
      "@/lib/space-invaders-replay",
      "@/lib/user-profile",
      "../asteroids-replay",
      "../leaderboard",
      "../pong-replay",
      "../space-invaders-replay",
      "../user-profile",
      "createGameLeaderboardKey",
      "recordGameSession",
      "saveReplay",
      "useGameLeaderboard",
      "useGameLeaderboardPresenter",
      "useGameSession",
    ]) {
      expect(combinedSource).not.toContain(forbidden);
    }
  });

  it("only accepts Pong serve input from the current serving paddle", () => {
    const store = createTestRoomStore();
    const started = createStartedPongRoom(store);
    const serveSide = expectPongGame(started).snapshot.serveSide;
    const servingParticipantId = serveSide === "left" ? "host-1" : "guest-1";
    const receivingParticipantId = serveSide === "left" ? "guest-1" : "host-1";

    expect(
      store.applyCommand("ROOM1", {
        input: {
          type: "pong.serve",
        },
        participantId: receivingParticipantId,
        matchId: 1,
        type: "game.input",
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Only the serving paddle can serve the ball.",
      success: false,
    });

    const served = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          type: "pong.serve",
        },
        participantId: servingParticipantId,
        matchId: 1,
        type: "game.input",
      }),
    );

    const servedPongGame = expectPongGame(served).snapshot;

    expect(servedPongGame.status).toBe("running");
    expect(servedPongGame.ball.velocity.y).toBe(0);
    expect(Math.sign(servedPongGame.ball.velocity.x)).toBe(
      serveSide === "left" ? 1 : -1,
    );
  });

  it("rejects invalid, observer, unseated, and non-Pong game input", () => {
    const store = createTestRoomStore();

    createStartedPongRoom(store);

    expect(
      store.applyCommand("ROOM1", {
        input: {
          direction: "sideways",
          type: "pong.setPaddleDirection",
        },
        participantId: "host-1",
        matchId: 1,
        type: "game.input",
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Pong paddle direction must be up, down, or null.",
      success: false,
    });
    expect(
      store.applyCommand("ROOM1", {
        input: {
          direction: "down",
          type: "pong.setPaddleDirection",
        },
        participantId: "missing",
        matchId: 1,
        type: "game.input",
      }),
    ).toEqual({
      code: "participant-not-found",
      error: "Participant is not in the Pong room.",
      success: false,
    });

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Late Observer",
        type: "room.joinObserver",
      }),
    );
    expect(
      store.applyCommand("ROOM1", {
        input: {
          direction: "down",
          type: "pong.setPaddleDirection",
        },
        participantId: "guest-2",
        matchId: 1,
        type: "game.input",
      }),
    ).toEqual({
      code: "participant-not-seated",
      error: "Participant does not occupy a Pong paddle seat.",
      success: false,
    });

    const nonPongStore = createTestRoomStore({
      participantIds: ["host-1"],
      roomCodes: ["SNAKE1"],
    });

    expectStoreSuccess(
      nonPongStore.createRoom({
        host: HOST_USER,
        settings: { gameId: "snake" },
      }),
    );
    expect(
      nonPongStore.applyCommand("SNAKE1", {
        input: {
          direction: "up",
          type: "pong.setPaddleDirection",
        },
        participantId: "host-1",
        matchId: 1,
        type: "game.input",
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Game input is not supported for snake rooms.",
      success: false,
    });
  });

  it("rejects invalid, observer, and mismatched Asteroids game input", () => {
    const store = createTestRoomStore();

    createStartedAsteroidsRoom(store);

    expect(
      store.applyCommand("ROOM1", {
        input: {
          controls: {
            rotateLeft: "yes",
            rotateRight: false,
            thrust: true,
          },
          type: "asteroids.setShipControls",
        },
        participantId: "host-1",
        matchId: 1,
        type: "game.input",
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Asteroids ship control values must be booleans when provided.",
      success: false,
    });
    expect(
      store.applyCommand("ROOM1", {
        gameId: "pong",
        input: {
          type: "asteroids.fire",
        },
        participantId: "host-1",
        matchId: 1,
        type: "game.input",
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Game input game id must match the room game.",
      success: false,
    });

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Late Observer",
        type: "room.joinObserver",
      }),
    );
    expect(
      store.applyCommand("ROOM1", {
        input: {
          type: "asteroids.fire",
        },
        participantId: "guest-2",
        matchId: 1,
        type: "game.input",
      }),
    ).toEqual({
      code: "participant-not-seated",
      error: "Participant does not occupy an Asteroids ship seat.",
      success: false,
    });
  });

  it("pauses, resumes, and restarts the Pong runtime with room lifecycle", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });

    createStartedPongRoom(store, {
      gameId: "pong",
      parameters: {
        "pong-board-size": "1200x640",
      },
    });
    serveStartedPongRoom(store);
    nowMs += getPongTickDelay();

    const paused = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "pause",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );
    const pausedPongGame = expectPongGame(paused);
    const pausedBallX = pausedPongGame.snapshot.ball.position.x;
    const pausedGameSeq = pausedPongGame.seq;

    nowMs += getPongTickDelay() * 5;
    const stillPaused = expectStoreSuccess(store.getRoom("ROOM1"));
    const stillPausedPongGame = expectPongGame(stillPaused);

    expect(stillPausedPongGame.snapshot.status).toBe("paused");
    expect(stillPausedPongGame.snapshot.ball.position.x).toBe(pausedBallX);
    expect(stillPausedPongGame.seq).toBe(pausedGameSeq);

    const resumed = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "resume",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );

    const resumedPongGame = expectPongGame(resumed);

    expect(resumedPongGame.snapshot.status).toBe("running");

    nowMs += getPongScoreTickDelay();
    const scoredDown = expectStoreSuccess(store.getRoom("ROOM1"));
    const scoredDownPongGame = expectPongGame(scoredDown);

    expect(scoredDownPongGame.snapshot.remainingScore).toBeLessThan(
      resumedPongGame.snapshot.remainingScore,
    );

    const restarted = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "restart",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );

    expect(restarted.game!.snapshot).toMatchObject({
      remainingScore: getPongMaximumScore(resumedPongGame.snapshot.targetScore),
      score: {
        cpu: 0,
        player: 0,
      },
      status: "ready",
    });
  });

  it("pauses, resumes, restarts, and finishes the Space Invaders runtime", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });

    createStartedSpaceInvadersRoom(store);
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "right",
          type: "space-invaders.setShipDirection",
        },
        participantId: "host-1",
        matchId: 1,
        type: "game.input",
      }),
    );

    nowMs += getSpaceInvadersTickDelay();
    const moved = expectStoreSuccess(store.getRoom("ROOM1"));
    const movedGame = expectSpaceInvadersGame(moved);
    const movedShipX = movedGame.snapshot.ships["ship-a"].player.x;

    const paused = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "pause",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );

    expect(paused.room.status).toBe("paused");
    expect(expectSpaceInvadersGame(paused).snapshot.status).toBe("paused");

    nowMs += getSpaceInvadersTickDelay() * 5;
    const stillPaused = expectStoreSuccess(store.getRoom("ROOM1"));
    const stillPausedGame = expectSpaceInvadersGame(stillPaused);

    expect(stillPausedGame.snapshot.ships["ship-a"].player.x).toBe(movedShipX);
    expect(stillPausedGame.seq).toBe(expectSpaceInvadersGame(paused).seq);

    const resumed = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "resume",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );

    expect(resumed.room.status).toBe("running");
    expect(expectSpaceInvadersGame(resumed).snapshot.status).toBe("running");

    nowMs += getSpaceInvadersTickDelay();
    const advancedAfterResume = expectStoreSuccess(store.getRoom("ROOM1"));

    expect(
      expectSpaceInvadersGame(advancedAfterResume).snapshot.ships["ship-a"].player.x,
    ).toBeGreaterThan(movedShipX);

    const restarted = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "restart",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );
    const restartedGame = expectSpaceInvadersGame(restarted);

    expect(restarted.room.status).toBe("running");
    expect(restarted.room.matchId).toBe(2);
    expect(restartedGame.matchId).toBe(2);
    expect(restartedGame.seq).toBe(1);
    expect(restartedGame.heldInputs).toEqual({});
    expect(restartedGame.snapshot).toMatchObject({
      score: 0,
      status: "running",
      ships: {
        "ship-a": {
          playerShots: [],
          seat: "ship-a",
        },
        "ship-b": {
          playerShots: [],
          seat: "ship-b",
        },
      },
    });

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "left",
          type: "space-invaders.setShipDirection",
        },
        participantId: "guest-1",
        matchId: 2,
        type: "game.input",
      }),
    );
    const finished = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "finish",
        participantId: "host-1",
        matchId: 2,
        type: "room.lifecycle",
      }),
    );
    const finishedGame = expectSpaceInvadersGame(finished);

    expect(finished.room.status).toBe("finished");
    expect(finishedGame.heldInputs).toEqual({});
    expect(finishedGame.snapshot.status).toBe("paused");
  });

  it("pauses, resumes, and finishes the Asteroids runtime", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });

    createStartedAsteroidsRoom(store);
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          controls: {
            rotateLeft: false,
            rotateRight: false,
            thrust: true,
          },
          type: "asteroids.setShipControls",
        },
        participantId: "host-1",
        matchId: 1,
        type: "game.input",
      }),
    );

    nowMs += getAsteroidsTickDelay();
    const moved = expectStoreSuccess(store.getRoom("ROOM1"));
    const movedGame = expectAsteroidsGame(moved);
    const movedShipY = movedGame.snapshot.ships["ship-a"].ship.y;

    const paused = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "pause",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );

    expect(paused.room.status).toBe("paused");
    expect(expectAsteroidsGame(paused).snapshot.status).toBe("paused");

    nowMs += getAsteroidsTickDelay() * 5;
    const stillPaused = expectStoreSuccess(store.getRoom("ROOM1"));
    const stillPausedGame = expectAsteroidsGame(stillPaused);

    expect(stillPausedGame.snapshot.ships["ship-a"].ship.y).toBe(movedShipY);
    expect(stillPausedGame.seq).toBe(expectAsteroidsGame(paused).seq);

    const resumed = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "resume",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );

    expect(resumed.room.status).toBe("running");
    expect(expectAsteroidsGame(resumed).snapshot.status).toBe("running");

    nowMs += getAsteroidsTickDelay();
    const advancedAfterResume = expectStoreSuccess(store.getRoom("ROOM1"));

    expect(
      expectAsteroidsGame(advancedAfterResume).snapshot.ships["ship-a"].ship.y,
    ).toBeLessThan(movedShipY);

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          controls: {
            rotateLeft: true,
            rotateRight: false,
            thrust: false,
          },
          type: "asteroids.setShipControls",
        },
        participantId: "guest-1",
        matchId: 1,
        type: "game.input",
      }),
    );
    const finished = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "finish",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      }),
    );
    const finishedGame = expectAsteroidsGame(finished);

    expect(finished.room.status).toBe("finished");
    expect(finishedGame.heldInputs).toEqual({});
    expect(finishedGame.snapshot.status).toBe("paused");
  });

  it("caps request-driven Pong catch-up deterministically", () => {
    let nowMs = 0;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    createStartedPongRoom(store, {
      gameId: "pong",
      parameters: {
        "pong-board-size": "1200x640",
      },
    });
    const started = serveStartedPongRoom(store);
    const initialGame = expectPongGame(started).snapshot;

    nowMs += getPongScoreTickDelay() * (PONG_RUNTIME_CATCH_UP_TICK_LIMIT + 20);
    const advanced = expectStoreSuccess(store.getRoom("ROOM1"));
    const advancedPongGame = expectPongGame(advanced).snapshot;

    expect(advancedPongGame.ball.position.x).toBeCloseTo(
      initialGame.ball.position.x +
        initialGame.ball.velocity.x * PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
    );
    expect(advancedPongGame.remainingScore).toBe(
      initialGame.remainingScore - PONG_RUNTIME_CATCH_UP_TICK_LIMIT * 5,
    );
  });

  it("returns immutable room snapshots", () => {
    const store = createTestRoomStore();
    const snapshot = expectStoreSuccess(
      store.createRoom({
        host: HOST_USER,
        settings: {
          gameId: "pong",
          parameters: {
            nested: {
              targetScore: 5,
            },
          },
        },
      }),
    );

    snapshot.room.participants[0]!.displayName = "Changed Host";
    (
      snapshot.room.settings.parameters?.nested as {
        targetScore: number;
      }
    ).targetScore = 11;

    const nextSnapshot = expectStoreSuccess(store.getRoom("room1"));

    expect(nextSnapshot.room.participants[0]?.displayName).toBe("Ada Host");
    expect(nextSnapshot.room.settings).toEqual({
      gameId: "pong",
      parameters: {
        nested: {
          targetScore: 5,
        },
      },
    });
  });

  it("returns immutable Pong game snapshots", () => {
    const store = createTestRoomStore();
    const snapshot = createStartedPongRoom(store);
    const pongGame = expectPongGame(snapshot);

    pongGame.snapshot.playerPaddle.y = 0;
    pongGame.snapshot.score.player = 99;
    const mutableHeldInputs = pongGame.heldInputs as {
      left?: { down?: boolean };
    };
    mutableHeldInputs.left = { down: true };

    const nextSnapshot = expectStoreSuccess(store.getRoom("ROOM1"));
    const nextPongGame = expectPongGame(nextSnapshot);

    expect(nextPongGame.snapshot.playerPaddle.y).not.toBe(0);
    expect(nextPongGame.snapshot.score.player).toBe(0);
    expect(nextPongGame.heldInputs).toEqual({});
  });

  it("returns immutable Space Invaders game snapshots", () => {
    const store = createTestRoomStore({ getNowMs: () => 1_000 });

    createStartedSpaceInvadersRoom(store);
    const snapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "right",
          type: "space-invaders.setShipDirection",
        },
        participantId: "host-1",
        matchId: 1,
        type: "game.input",
      }),
    );
    const spaceInvadersGame = expectSpaceInvadersGame(snapshot);

    spaceInvadersGame.snapshot.ships["ship-a"].player.x = 0;
    spaceInvadersGame.snapshot.score = 99;
    const mutableHeldInputs = spaceInvadersGame.heldInputs as {
      "ship-a"?: { left?: boolean };
    };
    mutableHeldInputs["ship-a"] = { left: true };

    const nextSnapshot = expectStoreSuccess(store.getRoom("ROOM1"));
    const nextSpaceInvadersGame = expectSpaceInvadersGame(nextSnapshot);

    expect(nextSpaceInvadersGame.snapshot.ships["ship-a"].player.x).not.toBe(0);
    expect(nextSpaceInvadersGame.snapshot.score).toBe(0);
    expect(nextSpaceInvadersGame.heldInputs).toEqual({
      "ship-a": {
        right: true,
      },
    });
  });

  it("returns immutable Asteroids game snapshots", () => {
    const store = createTestRoomStore({ getNowMs: () => 1_000 });

    createStartedAsteroidsRoom(store);
    const snapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          controls: {
            rotateLeft: false,
            rotateRight: true,
            thrust: true,
          },
          type: "asteroids.setShipControls",
        },
        participantId: "host-1",
        matchId: 1,
        type: "game.input",
      }),
    );
    const asteroidsGame = expectAsteroidsGame(snapshot);

    asteroidsGame.snapshot.ships["ship-a"].ship.x = 0;
    asteroidsGame.snapshot.score = 99;
    asteroidsGame.snapshot.asteroids[0]!.shape[0] = 99;
    const mutableHeldInputs = asteroidsGame.heldInputs as {
      "ship-a"?: { rotateLeft?: boolean };
    };
    mutableHeldInputs["ship-a"] = { rotateLeft: true };

    const nextSnapshot = expectStoreSuccess(store.getRoom("ROOM1"));
    const nextAsteroidsGame = expectAsteroidsGame(nextSnapshot);

    expect(nextAsteroidsGame.snapshot.ships["ship-a"].ship.x).not.toBe(0);
    expect(nextAsteroidsGame.snapshot.score).toBe(0);
    expect(nextAsteroidsGame.snapshot.asteroids[0]?.shape[0]).not.toBe(99);
    expect(nextAsteroidsGame.heldInputs).toEqual({
      "ship-a": {
        rotateRight: true,
        thrust: true,
      },
    });
  });
});
