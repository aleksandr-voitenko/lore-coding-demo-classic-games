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
const DIAGNOSTICS_PING_WARNING_MS = 80;
const DIAGNOSTICS_PING_BAD_MS = 150;
const DIAGNOSTICS_JITTER_WARNING_MS = 15;
const DIAGNOSTICS_JITTER_BAD_MS = 35;
const DIAGNOSTICS_STREAM_GAPS_BAD = 3;
const DIAGNOSTICS_RECONCILIATION_WARNING_RATIO = 0.75;
const DIAGNOSTICS_RECONCILIATION_BAD_RATIO = 1.25;

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

export type MultiplayerRoomDiagnosticsHealth =
  | "bad"
  | "healthy"
  | "neutral"
  | "warning";

export type MultiplayerRoomDiagnosticsHealthSummary = {
  jitter: MultiplayerRoomDiagnosticsHealth;
  ping: MultiplayerRoomDiagnosticsHealth;
  reconciliation: MultiplayerRoomDiagnosticsHealth;
  stream: MultiplayerRoomDiagnosticsHealth;
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
let cachedDiagnosticsModeSearch: string | null = null;
let cachedDiagnosticsMode: MultiplayerRoomDiagnosticsMode =
  DISABLED_DIAGNOSTICS_MODE;

export function getMultiplayerRoomDiagnosticsMode(search: string | null | undefined) {
  if (search === null || search === undefined || search.trim().length === 0) {
    return DISABLED_DIAGNOSTICS_MODE;
  }

  const normalizedSearch = stripSearchPrefix(search.trim());

  if (cachedDiagnosticsModeSearch === normalizedSearch) {
    return cachedDiagnosticsMode;
  }

  const params = new URLSearchParams(normalizedSearch);
  const values = [
    ...params.getAll(MULTIPLAYER_DIAGNOSTICS_QUERY_PARAM),
    ...params.getAll(MULTIPLAYER_DIAGNOSTICS_LOG_QUERY_PARAM),
  ];

  if (values.length === 0) {
    cachedDiagnosticsModeSearch = normalizedSearch;
    cachedDiagnosticsMode = DISABLED_DIAGNOSTICS_MODE;
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
    cachedDiagnosticsModeSearch = normalizedSearch;
    cachedDiagnosticsMode = DISABLED_DIAGNOSTICS_MODE;
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

  cachedDiagnosticsModeSearch = normalizedSearch;
  cachedDiagnosticsMode = {
    enabled: true,
    log,
    overlay: !tokens.includes("log-only"),
  } satisfies MultiplayerRoomDiagnosticsMode;

  return cachedDiagnosticsMode;
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
  const health = getMultiplayerRoomDiagnosticsHealth(metrics);

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
        <DiagnosticsMetric health={health.jitter} label="Jitter">
          {formatDiagnosticsNumber(metrics.snapshotJitterMs, 0)}ms
        </DiagnosticsMetric>
        <DiagnosticsMetric health={health.ping} label="Ping">
          {metrics.lastPingMs === null
            ? "waiting"
            : `${formatDiagnosticsNumber(metrics.lastPingMs, 0)}ms`}
        </DiagnosticsMetric>
        <DiagnosticsMetric health={health.stream} label="Stream gaps">
          {metrics.roomSeqGaps}
        </DiagnosticsMetric>
        <DiagnosticsMetric label="Tick catch-up">
          {metrics.gameSeqGaps}
        </DiagnosticsMetric>
        <DiagnosticsMetric health={health.reconciliation} label="Reconciled">
          {metrics.projectedReconciliations}
        </DiagnosticsMetric>
      </dl>
    </aside>
  );
}

function DiagnosticsMetric({
  children,
  health = "neutral",
  label,
}: {
  children: ReactNode;
  health?: MultiplayerRoomDiagnosticsHealth;
  label: string;
}) {
  return (
    <>
      <dt className="text-[var(--chrome-muted)]">{label}</dt>
      <dd
        className={`text-right tabular-nums ${getDiagnosticsHealthClassName(
          health,
        )}`}
        data-health={health}
        data-testid={`multiplayer-room-diagnostics-${label.toLowerCase().replaceAll(" ", "-")}`}
      >
        {children}
      </dd>
    </>
  );
}

export function getMultiplayerRoomDiagnosticsHealth(
  metrics: MultiplayerRoomDiagnosticsMetrics,
): MultiplayerRoomDiagnosticsHealthSummary {
  return {
    jitter: getLatencyHealth(
      metrics.snapshotJitterMs,
      DIAGNOSTICS_JITTER_WARNING_MS,
      DIAGNOSTICS_JITTER_BAD_MS,
    ),
    ping:
      metrics.lastPingMs === null
        ? "neutral"
        : getLatencyHealth(
            metrics.lastPingMs,
            DIAGNOSTICS_PING_WARNING_MS,
            DIAGNOSTICS_PING_BAD_MS,
          ),
    reconciliation: getReconciliationHealth(metrics),
    stream:
      metrics.roomSeqGaps === 0
        ? "healthy"
        : metrics.roomSeqGaps >= DIAGNOSTICS_STREAM_GAPS_BAD
          ? "bad"
          : "warning",
  };
}

function getLatencyHealth(
  valueMs: number,
  warningThresholdMs: number,
  badThresholdMs: number,
): MultiplayerRoomDiagnosticsHealth {
  if (valueMs >= badThresholdMs) {
    return "bad";
  }

  if (valueMs >= warningThresholdMs) {
    return "warning";
  }

  return "healthy";
}

function getReconciliationHealth(
  metrics: MultiplayerRoomDiagnosticsMetrics,
): MultiplayerRoomDiagnosticsHealth {
  if (metrics.snapshots === 0 || metrics.projectedReconciliations === 0) {
    return "neutral";
  }

  const reconciliationRatio = metrics.projectedReconciliations / metrics.snapshots;

  if (reconciliationRatio >= DIAGNOSTICS_RECONCILIATION_BAD_RATIO) {
    return "bad";
  }

  if (reconciliationRatio >= DIAGNOSTICS_RECONCILIATION_WARNING_RATIO) {
    return "warning";
  }

  return "healthy";
}

function getDiagnosticsHealthClassName(
  health: MultiplayerRoomDiagnosticsHealth,
) {
  if (health === "healthy") {
    return "text-[oklch(0.48_0.15_145)]";
  }

  if (health === "warning") {
    return "text-[oklch(0.62_0.14_75)]";
  }

  if (health === "bad") {
    return "text-[oklch(0.58_0.2_28)]";
  }

  return "text-[var(--chrome-ink)]";
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
    gameTickCatchUp: metrics.gameSeqGaps,
    jitterMs: Number(metrics.snapshotJitterMs.toFixed(1)),
    pingMs:
      metrics.lastPingMs === null ? null : Number(metrics.lastPingMs.toFixed(1)),
    reconciledFrames: metrics.projectedReconciliations,
    snapshotRatePerSecond: Number(metrics.snapshotRatePerSecond.toFixed(1)),
    snapshots: metrics.snapshots,
    streamGaps: metrics.roomSeqGaps,
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
