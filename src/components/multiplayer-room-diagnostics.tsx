"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type {
  MultiplayerRoomTransportPingSample,
  MultiplayerRoomTransportSnapshot,
  MultiplayerRoomTransportStatus,
} from "@/components/multiplayer-room-transport";

const MULTIPLAYER_DIAGNOSTICS_QUERY_PARAM = "multiplayerDiagnostics";
const MULTIPLAYER_DIAGNOSTICS_LOG_QUERY_PARAM = "multiplayerDiagnosticsLog";
const DIAGNOSTICS_SAMPLE_WINDOW_MS = 5_000;
const DIAGNOSTICS_LOG_INTERVAL_MS = 2_000;

export type MultiplayerRoomDiagnosticsMode = {
  enabled: boolean;
  log: boolean;
  overlay: boolean;
};

export type MultiplayerRoomDiagnosticsMetrics = {
  gameSeqGaps: number;
  lastGameSeq: number | null;
  lastPingMs: number | null;
  lastRoomSeq: number | null;
  pingSamples: number;
  projectedReconciliations: number;
  roomSeqGaps: number;
  snapshotJitterMs: number;
  snapshotRatePerSecond: number;
  snapshots: number;
  transportStatus: MultiplayerRoomTransportStatus;
};

export type MultiplayerRoomDiagnosticsState = {
  metrics: MultiplayerRoomDiagnosticsMetrics;
  snapshotReceivedAtMs: readonly number[];
};

type UseMultiplayerRoomDiagnosticsOptions = {
  enabled: boolean;
  log: boolean;
  transportStatus?: MultiplayerRoomTransportStatus;
};

const DISABLED_DIAGNOSTICS_MODE = {
  enabled: false,
  log: false,
  overlay: false,
} satisfies MultiplayerRoomDiagnosticsMode;

export function getMultiplayerRoomDiagnosticsMode(search: string | null | undefined) {
  if (search === null || search === undefined || search.trim().length === 0) {
    return DISABLED_DIAGNOSTICS_MODE;
  }

  const params = new URLSearchParams(stripSearchPrefix(search));
  const values = [
    ...params.getAll(MULTIPLAYER_DIAGNOSTICS_QUERY_PARAM),
    ...params.getAll(MULTIPLAYER_DIAGNOSTICS_LOG_QUERY_PARAM),
  ];

  if (values.length === 0) {
    return DISABLED_DIAGNOSTICS_MODE;
  }

  const tokens = values.flatMap((value) =>
    value
      .split(",")
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean),
  );
  const enabled = tokens.length === 0 || tokens.some(isDiagnosticsEnabledToken);

  if (!enabled) {
    return DISABLED_DIAGNOSTICS_MODE;
  }

  const log =
    params.has(MULTIPLAYER_DIAGNOSTICS_LOG_QUERY_PARAM) ||
    tokens.some(
      (token) =>
        token === "log" ||
        token === "console" ||
        token === "all" ||
        token === "log-only",
    );

  return {
    enabled: true,
    log,
    overlay: !tokens.includes("log-only"),
  } satisfies MultiplayerRoomDiagnosticsMode;
}

export function useMultiplayerRoomDiagnosticsMode() {
  return useSyncExternalStore(
    subscribeMultiplayerRoomDiagnosticsMode,
    getBrowserMultiplayerRoomDiagnosticsMode,
    () => DISABLED_DIAGNOSTICS_MODE,
  );
}

export function createInitialMultiplayerRoomDiagnosticsState(
  transportStatus: MultiplayerRoomTransportStatus,
): MultiplayerRoomDiagnosticsState {
  return {
    metrics: {
      gameSeqGaps: 0,
      lastGameSeq: null,
      lastPingMs: null,
      lastRoomSeq: null,
      pingSamples: 0,
      projectedReconciliations: 0,
      roomSeqGaps: 0,
      snapshotJitterMs: 0,
      snapshotRatePerSecond: 0,
      snapshots: 0,
      transportStatus,
    },
    snapshotReceivedAtMs: [],
  };
}

export function recordMultiplayerRoomDiagnosticsSnapshot(
  state: MultiplayerRoomDiagnosticsState,
  snapshot: MultiplayerRoomTransportSnapshot,
  receivedAtMs: number,
): MultiplayerRoomDiagnosticsState {
  const snapshotReceivedAtMs = [
    ...state.snapshotReceivedAtMs.filter(
      (sampleMs) => receivedAtMs - sampleMs <= DIAGNOSTICS_SAMPLE_WINDOW_MS,
    ),
    receivedAtMs,
  ];
  const lastRoomSeq = snapshot.seq;
  const nextGameSeq = snapshot.game?.seq ?? null;
  const roomSeqGaps =
    state.metrics.lastRoomSeq === null || lastRoomSeq <= state.metrics.lastRoomSeq + 1
      ? state.metrics.roomSeqGaps
      : state.metrics.roomSeqGaps + (lastRoomSeq - state.metrics.lastRoomSeq - 1);
  const gameSeqGaps =
    state.metrics.lastGameSeq === null ||
    nextGameSeq === null ||
    nextGameSeq <= state.metrics.lastGameSeq + 1
      ? state.metrics.gameSeqGaps
      : state.metrics.gameSeqGaps + (nextGameSeq - state.metrics.lastGameSeq - 1);

  return {
    metrics: {
      ...state.metrics,
      gameSeqGaps,
      lastGameSeq: nextGameSeq ?? state.metrics.lastGameSeq,
      lastRoomSeq,
      roomSeqGaps,
      snapshotJitterMs: getSnapshotJitterMs(snapshotReceivedAtMs),
      snapshotRatePerSecond: getSnapshotRatePerSecond(snapshotReceivedAtMs),
      snapshots: state.metrics.snapshots + 1,
    },
    snapshotReceivedAtMs,
  };
}

export function recordMultiplayerRoomDiagnosticsPingSample(
  state: MultiplayerRoomDiagnosticsState,
  sample: MultiplayerRoomTransportPingSample,
): MultiplayerRoomDiagnosticsState {
  return {
    ...state,
    metrics: {
      ...state.metrics,
      lastPingMs: sample.roundTripMs,
      pingSamples: state.metrics.pingSamples + 1,
    },
  };
}

export function recordMultiplayerRoomDiagnosticsProjectionReconciliation(
  state: MultiplayerRoomDiagnosticsState,
): MultiplayerRoomDiagnosticsState {
  return {
    ...state,
    metrics: {
      ...state.metrics,
      projectedReconciliations: state.metrics.projectedReconciliations + 1,
    },
  };
}

export function setMultiplayerRoomDiagnosticsTransportStatus(
  state: MultiplayerRoomDiagnosticsState,
  transportStatus: MultiplayerRoomTransportStatus,
): MultiplayerRoomDiagnosticsState {
  if (state.metrics.transportStatus === transportStatus) {
    return state;
  }

  return {
    ...state,
    metrics: {
      ...state.metrics,
      transportStatus,
    },
  };
}

export function useMultiplayerRoomDiagnostics({
  enabled,
  log,
  transportStatus = "unconfigured",
}: UseMultiplayerRoomDiagnosticsOptions) {
  const [state, setState] = useState(() =>
    createInitialMultiplayerRoomDiagnosticsState(transportStatus),
  );
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!enabled || !log || typeof window === "undefined") {
      return;
    }

    const logIntervalId = window.setInterval(() => {
      console.info(
        "[multiplayer diagnostics]",
        serializeMultiplayerRoomDiagnosticsMetrics(stateRef.current.metrics),
      );
    }, DIAGNOSTICS_LOG_INTERVAL_MS);

    return () => {
      window.clearInterval(logIntervalId);
    };
  }, [enabled, log]);

  const recordSnapshot = useCallback(
    (snapshot: MultiplayerRoomTransportSnapshot) => {
      if (!enabled) {
        return;
      }

      setState((current) =>
        recordMultiplayerRoomDiagnosticsSnapshot(current, snapshot, Date.now()),
      );
    },
    [enabled],
  );

  const recordPingSample = useCallback(
    (sample: MultiplayerRoomTransportPingSample) => {
      if (!enabled) {
        return;
      }

      setState((current) =>
        recordMultiplayerRoomDiagnosticsPingSample(current, sample),
      );
    },
    [enabled],
  );

  const recordProjectionReconciliation = useCallback(() => {
    if (!enabled) {
      return;
    }

    setState(recordMultiplayerRoomDiagnosticsProjectionReconciliation);
  }, [enabled]);

  const recordTransportStatus = useCallback(
    (nextTransportStatus: MultiplayerRoomTransportStatus) => {
      if (!enabled) {
        return;
      }

      setState((current) =>
        setMultiplayerRoomDiagnosticsTransportStatus(
          current,
          nextTransportStatus,
        ),
      );
    },
    [enabled],
  );

  return {
    metrics: state.metrics,
    recordPingSample,
    recordProjectionReconciliation,
    recordSnapshot,
    recordTransportStatus,
  };
}

export function MultiplayerRoomDiagnosticsOverlay({
  metrics,
}: {
  metrics: MultiplayerRoomDiagnosticsMetrics;
}) {
  return (
    <aside
      aria-label="Multiplayer diagnostics"
      className="fixed bottom-3 left-3 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)]/95 p-3 text-xs font-medium text-[var(--chrome-ink)] shadow-lg backdrop-blur"
      data-testid="multiplayer-room-diagnostics"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Multiplayer Diagnostics</span>
        <span
          className="rounded-sm border border-[var(--chrome-border)] px-2 py-0.5 text-[var(--chrome-muted)]"
          data-testid="multiplayer-room-diagnostics-status"
        >
          {metrics.transportStatus}
        </span>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
        <DiagnosticsMetric label="Snapshots">
          {formatDiagnosticsNumber(metrics.snapshotRatePerSecond, 1)}/s
        </DiagnosticsMetric>
        <DiagnosticsMetric label="Jitter">
          {formatDiagnosticsNumber(metrics.snapshotJitterMs, 0)}ms
        </DiagnosticsMetric>
        <DiagnosticsMetric label="Ping">
          {metrics.lastPingMs === null
            ? "waiting"
            : `${formatDiagnosticsNumber(metrics.lastPingMs, 0)}ms`}
        </DiagnosticsMetric>
        <DiagnosticsMetric label="Dropped seq">
          {metrics.roomSeqGaps + metrics.gameSeqGaps}
        </DiagnosticsMetric>
        <DiagnosticsMetric label="Reconciled">
          {metrics.projectedReconciliations}
        </DiagnosticsMetric>
      </dl>
    </aside>
  );
}

function DiagnosticsMetric({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <>
      <dt className="text-[var(--chrome-muted)]">{label}</dt>
      <dd className="text-right tabular-nums" data-testid={`multiplayer-room-diagnostics-${label.toLowerCase().replaceAll(" ", "-")}`}>
        {children}
      </dd>
    </>
  );
}

function getSnapshotRatePerSecond(snapshotReceivedAtMs: readonly number[]) {
  if (snapshotReceivedAtMs.length < 2) {
    return snapshotReceivedAtMs.length;
  }

  const firstSampleMs = snapshotReceivedAtMs[0]!;
  const lastSampleMs = snapshotReceivedAtMs[snapshotReceivedAtMs.length - 1]!;
  const elapsedSeconds = Math.max((lastSampleMs - firstSampleMs) / 1_000, 1);

  return (snapshotReceivedAtMs.length - 1) / elapsedSeconds;
}

function getSnapshotJitterMs(snapshotReceivedAtMs: readonly number[]) {
  if (snapshotReceivedAtMs.length < 3) {
    return 0;
  }

  const intervals = snapshotReceivedAtMs
    .slice(1)
    .map((sampleMs, index) => sampleMs - snapshotReceivedAtMs[index]!);
  const averageInterval =
    intervals.reduce((total, interval) => total + interval, 0) / intervals.length;
  const variance =
    intervals.reduce(
      (total, interval) => total + (interval - averageInterval) ** 2,
      0,
    ) / intervals.length;

  return Math.sqrt(variance);
}

function formatDiagnosticsNumber(value: number, maximumFractionDigits: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits,
  }).format(value);
}

function serializeMultiplayerRoomDiagnosticsMetrics(
  metrics: MultiplayerRoomDiagnosticsMetrics,
) {
  return {
    droppedSeq: metrics.roomSeqGaps + metrics.gameSeqGaps,
    jitterMs: Number(metrics.snapshotJitterMs.toFixed(1)),
    pingMs:
      metrics.lastPingMs === null ? null : Number(metrics.lastPingMs.toFixed(1)),
    reconciledFrames: metrics.projectedReconciliations,
    snapshotRatePerSecond: Number(metrics.snapshotRatePerSecond.toFixed(1)),
    snapshots: metrics.snapshots,
    transportStatus: metrics.transportStatus,
  };
}

function isDiagnosticsEnabledToken(token: string) {
  return token !== "0" && token !== "false" && token !== "off";
}

function stripSearchPrefix(search: string) {
  return search.startsWith("?") ? search.slice(1) : search;
}

function subscribeMultiplayerRoomDiagnosticsMode() {
  return () => {};
}

function getBrowserMultiplayerRoomDiagnosticsMode() {
  if (typeof window === "undefined") {
    return DISABLED_DIAGNOSTICS_MODE;
  }

  return getMultiplayerRoomDiagnosticsMode(window.location.search);
}
