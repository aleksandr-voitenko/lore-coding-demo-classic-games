import { describe, expect, it } from "vitest";

import {
  createPrivateRoom,
  replacePrivateRoomMatch,
  updatePrivateRoomSettings,
  type PrivateRoomSettings,
} from "./room";

const seats = [
  { id: "left", label: "Left", required: true },
  { id: "right", label: "Right", required: true },
];

function createRoom(settings: PrivateRoomSettings = { gameId: "pong" }) {
  return createPrivateRoom({
    code: "ROOM1",
    host: { displayName: "Host", participantId: "host", userId: "user-1" },
    seats,
    settings,
  });
}

function nestedSettings(arrayCount: number): PrivateRoomSettings {
  return JSON.parse(
    '{"gameId":"pong","parameters":{"future":' +
      "[".repeat(arrayCount) + "true" + "]".repeat(arrayCount) + "}}",
  ) as PrivateRoomSettings;
}

describe("private room settings admission", () => {
  it.each([31, 5_000, 20_000])("rejects %i nested arrays without cloning or throwing", (arrayCount) => {
    expect(createRoom(nestedSettings(arrayCount))).toMatchObject({
      code: "invalid-room-settings", success: false,
    });
  });

  it("rejects oversized UTF-8 settings while preserving the source room", () => {
    const created = createRoom();
    if (!created.success) throw new Error(created.error);
    const before = structuredClone(created.room);
    const settings: PrivateRoomSettings = {
      gameId: "pong", parameters: { future: "é".repeat(8_192) },
    };
    expect(updatePrivateRoomSettings(created.room, { participantId: "host", settings }))
      .toMatchObject({ code: "invalid-room-settings", success: false });
    expect(replacePrivateRoomMatch(created.room, { participantId: "host", seats, settings }))
      .toMatchObject({ code: "invalid-room-settings", success: false });
    expect(created.room).toEqual(before);
  });

  it("rejects cyclic settings through the domain error contract", () => {
    const parameters: Record<string, unknown> = {};
    parameters.self = parameters;
    expect(createRoom({ gameId: "pong", parameters } as PrivateRoomSettings))
      .toMatchObject({ code: "invalid-room-settings", success: false });
  });

  it("accepts 32 containers and returns independent JSON-serializable settings", () => {
    const settings = nestedSettings(30);
    const created = createRoom(settings);
    if (!created.success) throw new Error(created.error);
    expect(JSON.parse(JSON.stringify(created.room)).settings).toEqual(settings);
    (settings.parameters?.future as unknown[])[0] = "changed";
    expect(created.room.settings).toEqual(nestedSettings(30));
  });
});
