import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PrivateRoom } from "@/lib/multiplayer/room";

import {
  MultiplayerRoomDiagnosticsOverlay,
  createInitialMultiplayerRoomDiagnosticsState,
  getMultiplayerRoomDiagnosticsMode,
  getMultiplayerRoomDiagnosticsHealth,
  recordMultiplayerRoomDiagnosticsPingSample,
  recordMultiplayerRoomDiagnosticsProjectionReconciliation,
  recordMultiplayerRoomDiagnosticsSnapshot,
} from "./multiplayer-room-diagnostics";

const ROOM = {
  code: "ROOM1",
  hostParticipantId: "host-1",
  matchId: 1,
  nextMatchParticipantIds: [],
  observerLimit: 8,
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
          matchId: 1,
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
          matchId: 1,
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
          matchId: 1,
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
      gameSeqGapRatePerSecond: 0.4,
      gameSeqGapsInWindow: 2,
      lastGameSeq: 5,
      lastRoomSeq: 6,
      roomSeqGaps: 3,
      snapshots: 3,
    });
    expect(third.metrics.snapshotRatePerSecond).toBeCloseTo(0.83, 2);
    expect(third.metrics.snapshotJitterMs).toBeCloseTo(200, 0);

    const aged = recordMultiplayerRoomDiagnosticsSnapshot(
      third,
      {
        game: {
          gameId: "pong",
          matchId: 1,
          seq: 6,
          serverTimeMs: 4_000,
          snapshot: {},
        },
        room: ROOM,
        seq: 7,
      },
      8_000,
    );

    expect(aged.metrics.gameSeqGaps).toBe(2);
    expect(aged.metrics.gameSeqGapsInWindow).toBe(0);
    expect(aged.metrics.gameSeqGapRatePerSecond).toBe(0);
  });

  it("tracks ping samples and projection reconciliations", () => {
    const state = createInitialMultiplayerRoomDiagnosticsState("active");
    const pinged = recordMultiplayerRoomDiagnosticsPingSample(state, {
      clientTimeMs: 1_000,
      receivedAtMs: 1_042,
      roundTripMs: 42,
      serverTimeMs: 1_025,
    });
    const firstReconciled =
      recordMultiplayerRoomDiagnosticsProjectionReconciliation(pinged, 1_000);
    const secondReconciled =
      recordMultiplayerRoomDiagnosticsProjectionReconciliation(
        firstReconciled,
        2_000,
      );
    const agedReconciled =
      recordMultiplayerRoomDiagnosticsProjectionReconciliation(
        secondReconciled,
        7_100,
      );

    expect(secondReconciled.metrics).toMatchObject({
      lastPingMs: 42,
      pingSamples: 1,
      projectedReconciliationRatePerSecond: 0.4,
      projectedReconciliations: 2,
      projectedReconciliationsInWindow: 2,
    });
    expect(agedReconciled.metrics).toMatchObject({
      lastPingMs: 42,
      pingSamples: 1,
      projectedReconciliationRatePerSecond: 0.2,
      projectedReconciliations: 3,
      projectedReconciliationsInWindow: 1,
    });
  });

  it("starts a fresh game-sequence baseline when the match changes", () => {
    const first = recordMultiplayerRoomDiagnosticsSnapshot(
      createInitialMultiplayerRoomDiagnosticsState("active"),
      {
        game: {
          gameId: "pong",
          matchId: 1,
          seq: 20,
          serverTimeMs: 1_000,
          snapshot: {},
        },
        room: ROOM,
        seq: 4,
      },
      1_000,
    );
    const nextMatch = recordMultiplayerRoomDiagnosticsSnapshot(
      first,
      {
        game: {
          gameId: "pong",
          matchId: 2,
          seq: 1,
          serverTimeMs: 2_000,
          snapshot: {},
        },
        room: {
          ...ROOM,
          matchId: 2,
        },
        seq: 5,
      },
      2_000,
    );

    expect(nextMatch.metrics).toMatchObject({
      gameSeqGaps: 0,
      gameSeqGapsInWindow: 0,
      lastGameSeq: 1,
      lastMatchId: 2,
    });
  });

  it("classifies diagnostics health bands for live room tuning", () => {
    const healthy = getMultiplayerRoomDiagnosticsHealth({
      gameSeqGaps: 10,
      gameSeqGapRatePerSecond: 2,
      gameSeqGapsInWindow: 10,
      lastGameSeq: 10,
      lastMatchId: 1,
      lastPingMs: 42,
      lastRoomSeq: 20,
      pingSamples: 3,
      projectedReconciliations: 10,
      projectedReconciliationRatePerSecond: 10,
      projectedReconciliationsInWindow: 50,
      roomSeqGaps: 0,
      snapshotJitterMs: 8,
      snapshotRatePerSecond: 30,
      snapshots: 40,
      transportStatus: "active",
    });
    const warning = getMultiplayerRoomDiagnosticsHealth({
      gameSeqGaps: 10,
      gameSeqGapRatePerSecond: 2,
      gameSeqGapsInWindow: 10,
      lastGameSeq: 10,
      lastMatchId: 1,
      lastPingMs: 83,
      lastRoomSeq: 20,
      pingSamples: 3,
      projectedReconciliations: 35,
      projectedReconciliationRatePerSecond: 25,
      projectedReconciliationsInWindow: 125,
      roomSeqGaps: 1,
      snapshotJitterMs: 22,
      snapshotRatePerSecond: 30,
      snapshots: 40,
      transportStatus: "active",
    });
    const bad = getMultiplayerRoomDiagnosticsHealth({
      gameSeqGaps: 10,
      gameSeqGapRatePerSecond: 2,
      gameSeqGapsInWindow: 10,
      lastGameSeq: 10,
      lastMatchId: 1,
      lastPingMs: 170,
      lastRoomSeq: 20,
      pingSamples: 3,
      projectedReconciliations: 60,
      projectedReconciliationRatePerSecond: 40,
      projectedReconciliationsInWindow: 200,
      roomSeqGaps: 3,
      snapshotJitterMs: 42,
      snapshotRatePerSecond: 30,
      snapshots: 40,
      transportStatus: "active",
    });

    expect(healthy).toEqual({
      jitter: "healthy",
      ping: "healthy",
      reconciliation: "healthy",
      stream: "healthy",
    });
    expect(warning).toEqual({
      jitter: "warning",
      ping: "warning",
      reconciliation: "warning",
      stream: "warning",
    });
    expect(bad).toEqual({
      jitter: "bad",
      ping: "bad",
      reconciliation: "bad",
      stream: "bad",
    });
  });

  it("renders compact overlay metrics", () => {
    const markup = renderToStaticMarkup(
      <MultiplayerRoomDiagnosticsOverlay
        metrics={{
          gameSeqGaps: 1,
          gameSeqGapRatePerSecond: 0.2,
          gameSeqGapsInWindow: 1,
          lastGameSeq: 8,
          lastMatchId: 1,
          lastPingMs: 37,
          lastRoomSeq: 12,
          pingSamples: 3,
          projectedReconciliations: 5,
          projectedReconciliationRatePerSecond: 1,
          projectedReconciliationsInWindow: 5,
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
    expect(markup).toContain('data-health="warning"');
    expect(markup).toContain(">2</dd>");
    expect(markup).toContain("Tick catch-up");
    expect(markup).toContain("0.2/s");
    expect(markup).toContain("1.0/s");
  });
});
