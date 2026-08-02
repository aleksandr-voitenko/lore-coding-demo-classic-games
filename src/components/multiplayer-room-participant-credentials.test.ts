import { describe, expect, it } from "vitest";

import {
  readMultiplayerRoomParticipantCredentials,
  removeMultiplayerRoomParticipantCredentials,
  writeMultiplayerRoomParticipantCredentials,
} from "./multiplayer-room-participant-credentials";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("multiplayer room participant credentials", () => {
  it("stores opaque credentials in room-scoped session storage", () => {
    const storage = createMemoryStorage();
    const credentials = {
      participantCapability: "host-capability",
      participantId: "host-1",
      userId: "user-1",
    };

    expect(
      writeMultiplayerRoomParticipantCredentials("room1", credentials, storage),
    ).toBe(true);
    expect(
      readMultiplayerRoomParticipantCredentials("ROOM1", "user-1", storage),
    ).toEqual(credentials);

    removeMultiplayerRoomParticipantCredentials("ROOM1", storage);
    expect(
      readMultiplayerRoomParticipantCredentials("ROOM1", "user-1", storage),
    ).toBeNull();
  });

  it("does not restore credentials under a different signed-in account", () => {
    const storage = createMemoryStorage();

    writeMultiplayerRoomParticipantCredentials(
      "ROOM1",
      {
        participantCapability: "host-capability",
        participantId: "host-1",
        userId: "user-1",
      },
      storage,
    );

    expect(
      readMultiplayerRoomParticipantCredentials("ROOM1", "user-2", storage),
    ).toBeNull();
    expect(
      readMultiplayerRoomParticipantCredentials("ROOM1", "user-1", storage),
    ).toBeNull();
  });

  it("rejects malformed or unsupported room credentials", () => {
    const storage = createMemoryStorage();

    expect(
      writeMultiplayerRoomParticipantCredentials(
        "bad room",
        {
          participantCapability: "host-capability",
          participantId: "host-1",
          userId: null,
        },
        storage,
      ),
    ).toBe(false);
    expect(
      writeMultiplayerRoomParticipantCredentials(
        "ROOM1",
        {
          participantCapability: " ",
          participantId: "host-1",
          userId: null,
        },
        storage,
      ),
    ).toBe(false);
  });

  it("fails closed when browser privacy policy denies every storage operation", () => {
    const storage = {
      clear: () => {
        throw new Error("Storage denied");
      },
      getItem: () => {
        throw new Error("Storage denied");
      },
      key: () => {
        throw new Error("Storage denied");
      },
      length: 0,
      removeItem: () => {
        throw new Error("Storage denied");
      },
      setItem: () => {
        throw new Error("Storage denied");
      },
    } satisfies Storage;

    expect(() =>
      readMultiplayerRoomParticipantCredentials("ROOM1", "user-1", storage),
    ).not.toThrow();
    expect(
      readMultiplayerRoomParticipantCredentials("ROOM1", "user-1", storage),
    ).toBeNull();
  });
});
