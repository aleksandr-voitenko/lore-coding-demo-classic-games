import { describe, expect, it, vi } from "vitest";

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
});
