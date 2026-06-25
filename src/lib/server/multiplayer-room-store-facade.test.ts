import { afterEach, describe, expect, it, vi } from "vitest";

describe("multiplayer room store facade", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the local in-process room store when the service URL is unset", async () => {
    vi.resetModules();
    vi.stubEnv("MULTIPLAYER_ROOM_SERVICE_URL", "");

    const { InProcessMultiplayerRoomStore, getMultiplayerRoomStore } = await import(
      "./multiplayer-room-store"
    );
    const store = getMultiplayerRoomStore();

    expect(store).toBeInstanceOf(InProcessMultiplayerRoomStore);
    expect(getMultiplayerRoomStore()).toBe(store);
  });

  it("uses the HTTP room service client when the service URL is set", async () => {
    vi.resetModules();
    vi.stubEnv(
      "MULTIPLAYER_ROOM_SERVICE_URL",
      " http://127.0.0.1:3001/_internal/multiplayer/rooms ",
    );
    vi.stubEnv(
      "MULTIPLAYER_ROOM_SERVICE_CLIENT_BEARER_TOKEN",
      " service-secret ",
    );

    const { MultiplayerRoomServiceClient } = await import(
      "./multiplayer-room-service-client"
    );
    const { getMultiplayerRoomStore } = await import("./multiplayer-room-store");
    const store = getMultiplayerRoomStore();

    expect(store).toBeInstanceOf(MultiplayerRoomServiceClient);
    expect(getMultiplayerRoomStore()).toBe(store);
  });
});
