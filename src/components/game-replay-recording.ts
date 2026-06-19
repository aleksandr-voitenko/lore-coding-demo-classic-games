"use client";

import { useCallback, useRef, useState } from "react";

import type { ReplaySaveStatus } from "@/components/game-layout";
import {
  createGameReplayRecordingClock,
  getGameReplayRecordingElapsedMs,
  pauseGameReplayRecordingClock,
  resumeGameReplayRecordingClock,
  type GameReplayClockedRecording,
} from "@/components/game-replay-timing";
import type { GameReplayRun } from "@/lib/game-replay";

export { createGameReplayRecordingClock };

export type LiveGameReplayRecordedEvent = {
  elapsedMs: number;
  seq: number;
  tick: number;
  type: string;
};

export type LiveGameReplayRecording<
  Event extends LiveGameReplayRecordedEvent,
  Run extends GameReplayRun = GameReplayRun,
> = GameReplayClockedRecording & {
  events: Event[];
  nextSeq: number;
  run: Run;
  startedAt: string;
  tick: number;
};

type AppendLiveGameReplayEventOptions<EventInput> = {
  advancesTick?: boolean | ((event: EventInput) => boolean);
};

type LiveGameReplayRecordingLifecycleControls<
  Recording extends LiveGameReplayRecording<LiveGameReplayRecordedEvent>,
  Payload,
> = {
  isReplayRunPendingRef: { current: boolean };
  replayRecordingRef: { current: Recording | null };
  setFinishedReplay: (finishedReplay: Payload | null) => void;
  setIsReplayRunPending: (isReplayRunPending: boolean) => void;
  setReplaySaveStatus: (replaySaveStatus: ReplaySaveStatus) => void;
};

async function runLiveGameReplayRecordingLifecycle<
  Recording extends LiveGameReplayRecording<LiveGameReplayRecordedEvent>,
  Payload,
>(
  {
    isReplayRunPendingRef,
    replayRecordingRef,
    setFinishedReplay,
    setIsReplayRunPending,
    setReplaySaveStatus,
  }: LiveGameReplayRecordingLifecycleControls<Recording, Payload>,
  createRecording: () => Promise<Recording>,
  { installRecording }: { installRecording: boolean },
) {
  if (isReplayRunPendingRef.current) {
    return null;
  }

  isReplayRunPendingRef.current = true;
  replayRecordingRef.current = null;
  setIsReplayRunPending(true);
  setFinishedReplay(null);
  setReplaySaveStatus("idle");

  try {
    const recording = await createRecording();

    if (installRecording) {
      replayRecordingRef.current = recording;
    }

    return recording;
  } catch {
    setReplaySaveStatus("failed");
    return null;
  } finally {
    isReplayRunPendingRef.current = false;
    setIsReplayRunPending(false);
  }
}

export function createLiveGameReplayRecording<
  Event extends LiveGameReplayRecordedEvent,
  Run extends GameReplayRun,
  ExtraFields extends object = object,
>({
  clock = createGameReplayRecordingClock(),
  run,
  startedAt = new Date().toISOString(),
  ...extraFields
}: {
  clock?: GameReplayClockedRecording["clock"];
  run: Run;
  startedAt?: string;
} & ExtraFields): LiveGameReplayRecording<Event, Run> & ExtraFields {
  return {
    clock,
    events: [],
    nextSeq: 0,
    run,
    startedAt,
    tick: 0,
    ...extraFields,
  } as LiveGameReplayRecording<Event, Run> & ExtraFields;
}

export function appendLiveGameReplayEvent<
  Event extends LiveGameReplayRecordedEvent,
  Recording extends LiveGameReplayRecording<Event>,
  EventInput extends Omit<Event, "elapsedMs" | "seq" | "tick">,
>(
  recording: Recording,
  event: EventInput,
  { advancesTick = false }: AppendLiveGameReplayEventOptions<EventInput> = {},
) {
  const recordedEvent = {
    ...event,
    elapsedMs: getGameReplayRecordingElapsedMs(recording),
    seq: recording.nextSeq,
    tick: recording.tick,
  } as unknown as Event;

  recording.events.push(recordedEvent);
  recording.nextSeq += 1;

  const shouldAdvanceTick =
    typeof advancesTick === "function" ? advancesTick(event) : advancesTick;

  if (shouldAdvanceTick) {
    recording.tick += 1;
  }

  return recordedEvent;
}

export async function startLiveGameReplayRecording<
  Recording extends LiveGameReplayRecording<LiveGameReplayRecordedEvent>,
  Payload,
>(
  controls: LiveGameReplayRecordingLifecycleControls<Recording, Payload>,
  createRecording: () => Promise<Recording>,
) {
  return runLiveGameReplayRecordingLifecycle(controls, createRecording, {
    installRecording: true,
  });
}

export function useLiveGameReplayRecording<
  Recording extends LiveGameReplayRecording<LiveGameReplayRecordedEvent>,
  Payload,
>({ saveReplay }: { saveReplay: (payload: Payload) => Promise<void> }) {
  const [finishedReplay, setFinishedReplay] = useState<Payload | null>(null);
  const [isReplayRunPending, setIsReplayRunPending] = useState(false);
  const [replaySaveStatus, setReplaySaveStatus] =
    useState<ReplaySaveStatus>("idle");
  const isReplayRunPendingRef = useRef(false);
  const replayRecordingRef = useRef<Recording | null>(null);

  const resetReplayRecording = useCallback(() => {
    replayRecordingRef.current = null;
    setFinishedReplay(null);
    setReplaySaveStatus("idle");
  }, []);

  const beginReplayRecording = useCallback(
    (createRecording: () => Promise<Recording>) =>
      runLiveGameReplayRecordingLifecycle(
        {
          isReplayRunPendingRef,
          replayRecordingRef,
          setFinishedReplay,
          setIsReplayRunPending,
          setReplaySaveStatus,
        },
        createRecording,
        { installRecording: false },
      ),
    [],
  );

  const startReplayRecording = useCallback(
    (createRecording: () => Promise<Recording>) =>
      startLiveGameReplayRecording(
        {
          isReplayRunPendingRef,
          replayRecordingRef,
          setFinishedReplay,
          setIsReplayRunPending,
          setReplaySaveStatus,
        },
        createRecording,
      ),
    [],
  );

  const pauseRecordingClock = useCallback(() => {
    pauseGameReplayRecordingClock(replayRecordingRef.current);
  }, []);

  const resumeRecordingClock = useCallback(() => {
    resumeGameReplayRecordingClock(replayRecordingRef.current);
  }, []);

  const captureFinishedReplay = useCallback(
    (createPayload: (recording: Recording) => Payload) => {
      const recording = replayRecordingRef.current;

      if (recording === null || finishedReplay !== null) {
        return null;
      }

      const replay = createPayload(recording);

      replayRecordingRef.current = null;
      setFinishedReplay(replay);

      return replay;
    },
    [finishedReplay],
  );

  const saveFinishedReplay = useCallback(async () => {
    if (finishedReplay === null || replaySaveStatus === "saving") {
      return;
    }

    setReplaySaveStatus("saving");

    try {
      await saveReplay(finishedReplay);
      setReplaySaveStatus("saved");
    } catch {
      setReplaySaveStatus("failed");
    }
  }, [finishedReplay, replaySaveStatus, saveReplay]);

  return {
    beginReplayRecording,
    captureFinishedReplay,
    finishedReplay,
    isReplayRunPending,
    isReplayRunPendingRef,
    pauseRecordingClock,
    replayRecordingRef,
    replaySaveStatus,
    resetReplayRecording,
    resumeRecordingClock,
    saveFinishedReplay,
    setFinishedReplay,
    setReplaySaveStatus,
    startReplayRecording,
  };
}
