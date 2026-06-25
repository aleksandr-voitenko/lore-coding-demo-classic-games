import { describe, expect, it } from "vitest";

import {
  DEFAULT_PONG_PRIVATE_ROOM_SEATS,
  InProcessMultiplayerRoomStore,
  type MultiplayerRoomStoreResult,
} from "./multiplayer-room-store";

const HOST_USER = {
  displayName: "Ada Host",
  id: "user-1",
};

function createTestRoomStore({
  participantIds = ["host-1", "guest-1", "guest-2", "observer-1"],
  roomCodes = ["ROOM1"],
}: {
  participantIds?: string[];
  roomCodes?: string[];
} = {}) {
  let participantIdIndex = 0;
  let roomCodeIndex = 0;

  return new InProcessMultiplayerRoomStore({
    createParticipantId: ({ role }) =>
      participantIds[participantIdIndex++] ?? `${role}-${participantIdIndex}`,
    createRoomCode: () => roomCodes[roomCodeIndex++] ?? "ROOM-FALLBACK",
  });
}

function expectStoreSuccess(result: MultiplayerRoomStoreResult) {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.snapshot;
}

describe("in-process multiplayer room store", () => {
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
        participants: [
          {
            displayName: "Ada Host",
            id: "host-1",
            role: "host",
            userId: "user-1",
          },
        ],
        seats: DEFAULT_PONG_PRIVATE_ROOM_SEATS.map((seat) => ({
          ...seat,
          occupiedByParticipantId: null,
        })),
        settings: {
          gameId: "pong",
        },
        status: "lobby",
      },
      seq: 1,
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
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest Two",
        type: "room.joinObserver",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "left",
        type: "room.claimSeat",
      }),
    );
    const seatedRoom = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-2",
        seatId: "right",
        type: "room.claimSeat",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
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
      id: "observer-1",
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
        seatId: "left",
        type: "room.claimSeat",
      }),
    );
    const releasedGuestSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "left",
        type: "room.releaseSeat",
      }),
    );
    const seatedHostSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "right",
        type: "room.claimSeat",
      }),
    );

    expect(guestSnapshot.participant?.role).toBe("observer");
    expect(seatedGuestSnapshot.participant?.role).toBe("player");
    expect(seatedGuestSnapshot.room.seats[0]?.occupiedByParticipantId).toBe("guest-1");
    expect(releasedGuestSnapshot.participant?.role).toBe("observer");
    expect(releasedGuestSnapshot.room.seats[0]?.occupiedByParticipantId).toBeNull();
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
        type: "room.lifecycle",
      }),
    ).toMatchObject({
      code: "required-seats-empty",
      success: false,
    });
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
});
