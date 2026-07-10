import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrivateRoom } from "@/lib/multiplayer/room";

const mocks = vi.hoisted(() => ({
  useMultiplayerRoomWebSocketTransport: vi.fn(),
}));

vi.mock("@/components/multiplayer-room-transport", () => ({
  useMultiplayerRoomWebSocketTransport:
    mocks.useMultiplayerRoomWebSocketTransport,
}));

import {
  type MultiplayerRoomClientSnapshot,
  useMultiplayerRoomClient,
} from "./multiplayer-room-client";

type RoomClientOptions = Parameters<typeof useMultiplayerRoomClient>[0];
type RoomClientResult = ReturnType<typeof useMultiplayerRoomClient>;

const ROOM: PrivateRoom = {
  code: "ROOM1",
  hostParticipantId: "host-1",
  participants: [
    {
      displayName: "Ada",
      id: "host-1",
      role: "host",
      userId: "user-1",
    },
    {
      displayName: "Grace",
      id: "guest-1",
      role: "observer",
      userId: null,
    },
  ],
  seats: [
    {
      id: "left",
      label: "Left Paddle",
      occupiedByParticipantId: "host-1",
      required: true,
    },
  ],
  settings: {
    gameId: "pong",
  },
  status: "lobby",
};

const SNAPSHOT = {
  participantId: "host-1",
  room: ROOM,
  seq: 2,
} satisfies MultiplayerRoomClientSnapshot;

function createRoomTransport() {
  return {
    sendGameInput: vi.fn(async () => ({ gameSeq: 4, seq: 3 })),
    sendRoomCommand: vi.fn(async () => ({ participantId: "guest-1", seq: 3 })),
    status: "active" as const,
  };
}

function createRoomClientOptions(
  overrides: Partial<RoomClientOptions> = {},
): RoomClientOptions {
  return {
    diagnosticsEnabled: true,
    displayName: "Grace",
    enabled: true,
    lastSeq: { game: 4, room: 3 },
    onConnectionError: vi.fn(),
    onDiagnosticsPingSample: vi.fn(),
    onParticipantId: vi.fn(),
    onSnapshot: vi.fn(),
    participantId: "guest-1",
    roomCode: "ROOM1",
    ...overrides,
  };
}

function renderRoomClient(options: RoomClientOptions) {
  const resultRef: { current: RoomClientResult | null } = { current: null };

  function RoomClientHarness() {
    resultRef.current = useMultiplayerRoomClient(options);
    return null;
  }

  renderToStaticMarkup(<RoomClientHarness />);

  if (resultRef.current === null) {
    throw new Error("Room client hook did not render.");
  }

  return resultRef.current;
}

describe("useMultiplayerRoomClient", () => {
  beforeEach(() => {
    mocks.useMultiplayerRoomWebSocketTransport.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards connection options and tags transport snapshots as WebSocket state", () => {
    const transport = createRoomTransport();
    const options = createRoomClientOptions();

    mocks.useMultiplayerRoomWebSocketTransport.mockReturnValue(transport);
    renderRoomClient(options);

    expect(mocks.useMultiplayerRoomWebSocketTransport).toHaveBeenCalledOnce();
    const forwardedOptions =
      mocks.useMultiplayerRoomWebSocketTransport.mock.calls[0]![0];

    expect(forwardedOptions).toMatchObject({
      diagnosticsEnabled: options.diagnosticsEnabled,
      displayName: options.displayName,
      enabled: options.enabled,
      lastSeq: options.lastSeq,
      onConnectionError: options.onConnectionError,
      onDiagnosticsPingSample: options.onDiagnosticsPingSample,
      onParticipantId: options.onParticipantId,
      participantId: options.participantId,
      roomCode: options.roomCode,
    });

    forwardedOptions.onSnapshot(SNAPSHOT);

    expect(options.onSnapshot).toHaveBeenCalledWith(SNAPSHOT, "websocket");
  });

  it("reports HTTP snapshots and participant ids after host commands", async () => {
    const transport = createRoomTransport();
    const options = createRoomClientOptions();
    const fetcher = vi.fn(async () =>
      jsonResponse({
        participant: ROOM.participants[0],
        room: ROOM,
        seq: SNAPSHOT.seq,
      }),
    );

    vi.stubGlobal("fetch", fetcher);
    mocks.useMultiplayerRoomWebSocketTransport.mockReturnValue(transport);
    const client = renderRoomClient(options);

    await client.sendMessage({
      command: "start",
      participantId: "host-1",
      type: "room.lifecycle",
    });

    expect(options.onParticipantId).toHaveBeenCalledWith("host-1");
    expect(options.onSnapshot).toHaveBeenCalledWith(SNAPSHOT, "http");
    expect(transport.sendRoomCommand).not.toHaveBeenCalled();
    expect(transport.sendGameInput).not.toHaveBeenCalled();
  });

  it("reports participant ids returned by transport acknowledgements", async () => {
    const transport = createRoomTransport();
    const options = createRoomClientOptions();

    mocks.useMultiplayerRoomWebSocketTransport.mockReturnValue(transport);
    const client = renderRoomClient(options);

    await client.sendMessage({
      participantId: "guest-1",
      seatId: "left",
      type: "room.claimSeat",
    });

    expect(transport.sendRoomCommand).toHaveBeenCalledWith({
      participantId: "guest-1",
      seatId: "left",
      type: "room.claimSeat",
    });
    expect(options.onParticipantId).toHaveBeenCalledWith("guest-1");
    expect(options.onSnapshot).not.toHaveBeenCalled();
  });
});

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
  });
}
