import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PrivateRoom } from "@/lib/multiplayer/room";

import {
  MultiplayerRoomDiagnosticsOverlay,
  createInitialMultiplayerRoomDiagnosticsState,
  getMultiplayerRoomDiagnosticsMode,
  recordMultiplayerRoomDiagnosticsPingSample,
  recordMultiplayerRoomDiagnosticsProjectionReconciliation,
  recordMultiplayerRoomDiagnosticsSnapshot,
} from "./multiplayer-room-diagnostics";

const ROOM = {
  code: "ROOM1",
  hostParticipantId: "host-1",
  participants: [],
  seats: [],
  settings: {
    gameId: "pong",
  },
  status: "running",
} satisfies PrivateRoom;

describe("multiplayer room diagnostics", () => {
  it("parses opt-in overlay and logging modes from the room URL", () => {
    expect(getMultiplayerRoomDiagnosticsMode("?room=ROOM1")).toEqual({
      enabled: false,
      log: false,
      overlay: false,
    });
    expect(
      getMultiplayerRoomDiagnosticsMode(
        "?room=ROOM1&multiplayerDiagnostics=1",
      ),
    ).toEqual({
      enabled: true,
      log: false,
      overlay: true,
    });
    expect(
      getMultiplayerRoomDiagnosticsMode(
        "?room=ROOM1&multiplayerDiagnostics=log",
      ),
    ).toEqual({
      enabled: true,
      log: true,
      overlay: true,
    });
    expect(
      getMultiplayerRoomDiagnosticsMode(
        "?room=ROOM1&multiplayerDiagnostics=log-only",
      ),
    ).toEqual({
      enabled: true,
      log: true,
      overlay: false,
    });
    expect(
      getMultiplayerRoomDiagnosticsMode(
        "?room=ROOM1&multiplayerDiagnostics=off",
      ),
    ).toEqual({
      enabled: false,
      log: false,
      overlay: false,
    });
  });

  it("returns a stable diagnostics mode snapshot for the same URL search", () => {
    const search = "?room=ROOM1&multiplayerDiagnostics=1";

    expect(getMultiplayerRoomDiagnosticsMode(search)).toBe(
      getMultiplayerRoomDiagnosticsMode(search),
    );
  });

  it("tracks snapshot rate, jitter, and authoritative sequence gaps", () => {
    const first = recordMultiplayerRoomDiagnosticsSnapshot(
      createInitialMultiplayerRoomDiagnosticsState("active"),
      {
        game: {
          gameId: "pong",
          seq: 1,
          serverTimeMs: 1_000,
          snapshot: {},
        },
        room: ROOM,
        seq: 1,
      },
      0,
    );
    const second = recordMultiplayerRoomDiagnosticsSnapshot(
      first,
      {
        game: {
          gameId: "pong",
          seq: 2,
          serverTimeMs: 2_000,
          snapshot: {},
        },
        room: ROOM,
        seq: 2,
      },
      1_000,
    );
    const third = recordMultiplayerRoomDiagnosticsSnapshot(
      second,
      {
        game: {
          gameId: "pong",
          seq: 5,
          serverTimeMs: 3_000,
          snapshot: {},
        },
        room: ROOM,
        seq: 6,
      },
      2_400,
    );

    expect(third.metrics).toMatchObject({
      gameSeqGaps: 2,
      lastGameSeq: 5,
      lastRoomSeq: 6,
      roomSeqGaps: 3,
      snapshots: 3,
    });
    expect(third.metrics.snapshotRatePerSecond).toBeCloseTo(0.83, 2);
    expect(third.metrics.snapshotJitterMs).toBeCloseTo(200, 0);
  });

  it("tracks ping samples and projection reconciliations", () => {
    const state = createInitialMultiplayerRoomDiagnosticsState("active");
    const pinged = recordMultiplayerRoomDiagnosticsPingSample(state, {
      clientTimeMs: 1_000,
      receivedAtMs: 1_042,
      roundTripMs: 42,
      serverTimeMs: 1_025,
    });
    const reconciled =
      recordMultiplayerRoomDiagnosticsProjectionReconciliation(pinged);

    expect(reconciled.metrics).toMatchObject({
      lastPingMs: 42,
      pingSamples: 1,
      projectedReconciliations: 1,
    });
  });

  it("renders compact overlay metrics", () => {
    const markup = renderToStaticMarkup(
      <MultiplayerRoomDiagnosticsOverlay
        metrics={{
          gameSeqGaps: 1,
          lastGameSeq: 8,
          lastPingMs: 37,
          lastRoomSeq: 12,
          pingSamples: 3,
          projectedReconciliations: 5,
          roomSeqGaps: 2,
          snapshotJitterMs: 4.2,
          snapshotRatePerSecond: 29.7,
          snapshots: 40,
          transportStatus: "active",
        }}
      />,
    );

    expect(markup).toContain('data-testid="multiplayer-room-diagnostics"');
    expect(markup).toContain("29.7/s");
    expect(markup).toContain("4ms");
    expect(markup).toContain("37ms");
    expect(markup).toContain("Stream gaps");
    expect(markup).toContain(">2</dd>");
    expect(markup).toContain("Tick catch-up");
    expect(markup).toContain(">1</dd>");
    expect(markup).toContain(">5</dd>");
  });
});
