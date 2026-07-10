import { describe, expect, it, vi } from "vitest";

import { getPongTickDelay } from "@/lib/pong-game-engine";
import {
  advancePongMultiplayerTick,
  type PongMultiplayerGameSnapshot,
} from "@/lib/pong-multiplayer";

import type {
  MultiplayerRoomSnapshot,
  MultiplayerRoomStoreResult,
} from "./multiplayer-room-runtime";

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

describe("multiplayer room runtime boundary", () => {
  it("imports and constructs without resolving the Next server-only marker", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => {
      throw new Error("The reusable multiplayer runtime must not import server-only.");
    });

    try {
      const { InProcessMultiplayerRoomStore } = await import(
        "./multiplayer-room-runtime"
      );
      const store = new InProcessMultiplayerRoomStore({
        createParticipantId: () => "host-1",
        createRoomCode: () => "ROOM1",
        getNowMs: () => 1_000,
      });

      expect(
        store.createRoom({
          host: {
            displayName: "Ada Host",
            id: "user-1",
          },
        }),
      ).toMatchObject({
        snapshot: {
          room: {
            code: "ROOM1",
            hostParticipantId: "host-1",
          },
        },
        success: true,
      });
    } finally {
      vi.doUnmock("server-only");
    }
  });

  it("catches up elapsed Pong ticks in one runtime snapshot sequence", async () => {
    const { InProcessMultiplayerRoomStore } = await import(
      "./multiplayer-room-runtime"
    );
    const participantIds = ["host-1", "guest-1"];
    let nowMs = 0;
    let participantIdIndex = 0;
    const store = new InProcessMultiplayerRoomStore({
      createParticipantId: ({ role }) =>
        participantIds[participantIdIndex++] ?? `${role}-${participantIdIndex}`,
      createRoomCode: () => "ROOM1",
      getNowMs: () => nowMs,
    });

    expectStoreSuccess(
      store.createRoom({
        host: {
          displayName: "Ada Host",
          id: "user-1",
        },
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest Hero",
        type: "room.joinObserver",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "left",
        type: "room.claimSeat",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "right",
        type: "room.claimSeat",
      }),
    );

    const started = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );
    const serveSide = expectPongGame(started).snapshot.serveSide;
    const served = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          type: "pong.serve",
        },
        participantId: serveSide === "left" ? "host-1" : "guest-1",
        type: "game.input",
      }),
    );
    const servedGame = expectPongGame(served);
    const elapsedTickCount = 3;
    let expectedGame = servedGame.snapshot;

    for (let tickIndex = 0; tickIndex < elapsedTickCount; tickIndex += 1) {
      expectedGame = advancePongMultiplayerTick(expectedGame);
    }

    nowMs += getPongTickDelay() * elapsedTickCount;

    const advanced = expectStoreSuccess(store.getRoom("ROOM1"));
    const advancedGame = expectPongGame(advanced);

    expect(advancedGame.seq).toBe(servedGame.seq + 1);
    expect(advancedGame.serverTimeMs).toBe(nowMs);
    expect(advancedGame.snapshot.ball.position).toEqual(
      expectedGame.ball.position,
    );
  });

  it("keeps only current state through high-frequency advancement and room restarts", async () => {
    const { InProcessMultiplayerRoomStore } = await import(
      "./multiplayer-room-runtime"
    );
    const participantIds = ["host-1", "guest-1"];
    let nowMs = 0;
    let participantIdIndex = 0;
    const store = new InProcessMultiplayerRoomStore({
      createParticipantId: ({ role }) =>
        participantIds[participantIdIndex++] ?? `${role}-${participantIdIndex}`,
      createRoomCode: () => "ROOM1",
      getNowMs: () => nowMs,
    });

    expectStoreSuccess(
      store.createRoom({
        host: {
          displayName: "Ada Host",
          id: "user-1",
        },
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest Hero",
        type: "room.joinObserver",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "left",
        type: "room.claimSeat",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "right",
        type: "room.claimSeat",
      }),
    );

    const started = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );
    const serveSide = expectPongGame(started).snapshot.serveSide;
    const served = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          type: "pong.serve",
        },
        participantId: serveSide === "left" ? "host-1" : "guest-1",
        type: "game.input",
      }),
    );
    const servedGame = expectPongGame(served);
    const elapsedTickCount = 30;
    let expectedGame = servedGame.snapshot;
    let advanced = served;

    for (let tickIndex = 0; tickIndex < elapsedTickCount; tickIndex += 1) {
      expectedGame = advancePongMultiplayerTick(expectedGame);
      nowMs += getPongTickDelay();
      advanced = expectStoreSuccess(store.getRoom("ROOM1"));
    }

    const advancedGame = expectPongGame(advanced);

    expect(advancedGame.seq).toBe(servedGame.seq + elapsedTickCount);
    expect(advancedGame.serverTimeMs).toBe(nowMs);
    expect(advancedGame.snapshot.ball.position).toEqual(
      expectedGame.ball.position,
    );
    expect(store).not.toHaveProperty("getRoomEventLog");

    const finished = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "finish",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );
    expect(finished.room.status).toBe("finished");
    expect(expectStoreSuccess(store.getRoom("ROOM1")).room.status).toBe(
      "finished",
    );

    const restarted = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "restart",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );
    expect(restarted.room.status).toBe("running");
    expect(expectPongGame(restarted).snapshot.status).toBe("ready");
  });
});
