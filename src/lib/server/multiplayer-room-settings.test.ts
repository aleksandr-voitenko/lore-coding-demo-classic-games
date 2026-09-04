import { describe, expect, it } from "vitest";

import { InProcessMultiplayerRoomStore } from "./multiplayer-room-runtime";

function oversizedSettings() {
  return { gameId: "pong" as const, parameters: { future: "x".repeat(16 * 1024) } };
}

describe("canonical room settings admission", () => {
  it("rejects invalid creation before consuming room capacity or account membership", () => {
    const store = new InProcessMultiplayerRoomStore({
      createRoomCode: () => "ROOM1", createParticipantId: () => "host", maxRooms: 1,
    });
    const host = { id: "user-1", displayName: "Host" };
    expect(store.createRoom({ host, settings: oversizedSettings() })).toMatchObject({
      code: "invalid-room-settings", success: false,
    });
    expect(store.createRoom({ host })).toMatchObject({ success: true });
  });

  it.each(["room.updateSettings", "room.replaceMatch"] as const)(
    "rejects %s before advancing a running match or changing room state",
    (type) => {
      let nowMs = 0;
      let nextParticipant = 0;
      const store = new InProcessMultiplayerRoomStore({
        createRoomCode: () => "ROOM1",
        createParticipantId: () => nextParticipant++ === 0 ? "host" : "guest",
        getNowMs: () => nowMs,
      });
      store.createRoom({ host: { id: "user-1", displayName: "Host" } });
      store.applyCommand("ROOM1", { type: "room.joinPlayer", displayName: "Guest" });
      store.applyCommand("ROOM1", {
        type: "room.lifecycle", command: "start", participantId: "host", matchId: 1,
      });
      const started = store.getRoom("ROOM1");
      if (!started.success || started.snapshot.game?.gameId !== "pong") {
        throw new Error("Expected a started Pong match.");
      }
      store.applyCommand("ROOM1", {
        type: "game.input", matchId: 1,
        participantId: started.snapshot.game.snapshot.serveSide === "left" ? "host" : "guest",
        input: { type: "pong.serve" },
      });
      const before = store.getRoom("ROOM1");
      expect(before).toMatchObject({ success: true, snapshot: { room: { status: "running" } } });
      nowMs = 1_000;
      expect.soft(store.applyCommand("ROOM1", {
        type, matchId: 1, participantId: "host", settings: oversizedSettings(),
      })).toMatchObject({ code: "invalid-room-settings", success: false });
      nowMs = 0;
      expect(store.getRoom("ROOM1")).toEqual(before);
    },
  );
});

describe("bounded room snapshot transport", () => {
  it("keeps admitted boundary settings serializable and independent from input and snapshots", () => {
    const parameters = { future: "" };
    const settings = { gameId: "pong" as const, parameters };
    const overhead = new TextEncoder().encode(JSON.stringify(settings)).byteLength;
    parameters.future = "x".repeat(16 * 1024 - overhead);
    const store = new InProcessMultiplayerRoomStore({
      createRoomCode: () => "ROOM1", createParticipantId: () => "host",
    });
    const result = store.createRoom({ host: { id: "user-1", displayName: "Host" }, settings });
    if (!result.success) throw new Error(result.error);
    const transportJson = JSON.stringify({ type: "room.snapshot", snapshot: result.snapshot });
    const wireSnapshot = JSON.parse(transportJson).snapshot;
    expect(wireSnapshot.room.settings).toEqual(settings);
    expect(new TextEncoder().encode(transportJson).byteLength).toBeLessThan(64 * 1024);
    parameters.future = "source changed";
    (result.snapshot.room.settings.parameters as { future: string }).future = "snapshot changed";
    const latest = store.getRoom("ROOM1");
    if (!latest.success) throw new Error(latest.error);
    expect(latest.snapshot.room.settings).toEqual(wireSnapshot.room.settings);
  });
});
