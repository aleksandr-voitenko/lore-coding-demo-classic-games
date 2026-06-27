"use client";

import { useEffect, useRef, useState } from "react";

export type ClientProjectionFrameKey = boolean | number | string | null;

export type ClientProjectionClockOptions<TSnapshot, TValue, TStatus> = {
  baseValue: TValue;
  /**
   * Return a stable primitive for each distinct projected render state.
   * Capped projections should keep returning the final key after the visual
   * projection window is exhausted.
   */
  getProjectionFrameKey: (
    snapshot: TSnapshot,
    elapsedMs: number,
  ) => ClientProjectionFrameKey;
  isProjectionEnabled: (snapshot: TSnapshot) => boolean;
  isProjectionFrameAdvanced?: (
    snapshot: TSnapshot,
    elapsedMs: number,
    frameKey: ClientProjectionFrameKey,
  ) => boolean;
  onReconcile?: () => void;
  project: (snapshot: TSnapshot, elapsedMs: number) => TValue;
  seq: number;
  serverTimeMs: number;
  snapshot: TSnapshot;
  status: TStatus;
};

type ClientProjection<TValue, TStatus> = {
  seq: number;
  serverTimeMs: number;
  status: TStatus;
  value: TValue;
};

function getClientProjectionNowMs() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export function useClientProjectionClock<TSnapshot, TValue, TStatus>({
  baseValue,
  getProjectionFrameKey,
  isProjectionFrameAdvanced = defaultIsProjectionFrameAdvanced,
  isProjectionEnabled,
  onReconcile,
  project,
  seq,
  serverTimeMs,
  snapshot,
  status,
}: ClientProjectionClockOptions<TSnapshot, TValue, TStatus>) {
  const snapshotRef = useRef(snapshot);
  const projectedSinceAuthoritativeSnapshotRef = useRef(false);
  const authoritativeSnapshotRef = useRef({
    seq,
    serverTimeMs,
  });
  const [projection, setProjection] = useState<ClientProjection<TValue, TStatus>>(
    () => ({
      seq,
      serverTimeMs,
      status,
      value: baseValue,
    }),
  );

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const previousAuthoritativeSnapshot = authoritativeSnapshotRef.current;
    const changedAuthoritativeSnapshot =
      previousAuthoritativeSnapshot.seq !== seq ||
      previousAuthoritativeSnapshot.serverTimeMs !== serverTimeMs;

    if (
      changedAuthoritativeSnapshot &&
      projectedSinceAuthoritativeSnapshotRef.current
    ) {
      onReconcile?.();
    }

    projectedSinceAuthoritativeSnapshotRef.current = false;
    authoritativeSnapshotRef.current = {
      seq,
      serverTimeMs,
    };
  }, [onReconcile, seq, serverTimeMs]);

  useEffect(() => {
    const baseSnapshot = snapshotRef.current;

    if (!isProjectionEnabled(baseSnapshot) || typeof window === "undefined") {
      return;
    }

    const receivedAtMs = getClientProjectionNowMs();
    let frameId: number | null = null;
    let hasProjectedFrame = false;
    let lastProjectionFrameKey: ClientProjectionFrameKey | undefined;

    function updateProjection(nowMs: number) {
      const elapsedMs = nowMs - receivedAtMs;
      const projectionFrameKey = getProjectionFrameKey(baseSnapshot, elapsedMs);
      const projectionFrameAdvanced = isProjectionFrameAdvanced(
        baseSnapshot,
        elapsedMs,
        projectionFrameKey,
      );

      if (
        !hasProjectedFrame ||
        !Object.is(projectionFrameKey, lastProjectionFrameKey)
      ) {
        setProjection({
          seq,
          serverTimeMs,
          status,
          value: project(baseSnapshot, elapsedMs),
        });
        if (projectionFrameAdvanced) {
          projectedSinceAuthoritativeSnapshotRef.current = true;
        }
        hasProjectedFrame = true;
        lastProjectionFrameKey = projectionFrameKey;
      }

      frameId = window.requestAnimationFrame(updateProjection);
    }

    frameId = window.requestAnimationFrame(updateProjection);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    getProjectionFrameKey,
    isProjectionFrameAdvanced,
    isProjectionEnabled,
    project,
    seq,
    serverTimeMs,
    status,
  ]);

  if (
    isProjectionEnabled(snapshot) &&
    projection.seq === seq &&
    projection.serverTimeMs === serverTimeMs &&
    Object.is(projection.status, status)
  ) {
    return projection.value;
  }

  return baseValue;
}

function defaultIsProjectionFrameAdvanced() {
  return true;
}
