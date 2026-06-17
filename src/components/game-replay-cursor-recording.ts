import {
  getGameReplayRecordingElapsedMs,
  type GameReplayClockedRecording,
} from "@/components/game-replay-timing";
import {
  shouldRecordGameReplayCursorEvent,
  type GameReplayCursorPosition,
} from "@/lib/game-replay";

export type LiveGameReplayCursorRecordedEvent = GameReplayCursorPosition & {
  elapsedMs: number;
  seq: number;
  tick: number;
  type: string;
};

export type LiveGameReplayCursorRecordingFields<
  CursorEvent extends LiveGameReplayCursorRecordedEvent,
> = {
  cursorEvents: CursorEvent[];
  lastCursorElapsedMs: number | null;
  nextCursorSeq: number;
};

type LiveGameReplayCursorRecording<
  CursorEvent extends LiveGameReplayCursorRecordedEvent,
> = GameReplayClockedRecording &
  LiveGameReplayCursorRecordingFields<CursorEvent> & {
    tick: number;
  };

type AppendLiveGameReplayCursorEventOptions = {
  force?: boolean;
  sampleIntervalMs: number;
  tick?: number;
};

type GameReplayBoardRect = Pick<
  DOMRectReadOnly,
  "height" | "left" | "top" | "width"
>;

type GameReplayBoardPointerEvent = {
  clientX: number;
  clientY: number;
  currentTarget: {
    getBoundingClientRect: () => GameReplayBoardRect;
  };
};

type GameReplayBoardActionEvent = {
  clientX: number;
  clientY: number;
  currentTarget: Element;
};

export function createLiveGameReplayCursorRecordingFields<
  CursorEvent extends LiveGameReplayCursorRecordedEvent,
>(): LiveGameReplayCursorRecordingFields<CursorEvent> {
  return {
    cursorEvents: [],
    lastCursorElapsedMs: null,
    nextCursorSeq: 0,
  };
}

export function appendLiveGameReplayCursorEvent<
  CursorEvent extends LiveGameReplayCursorRecordedEvent,
  EventInput extends Omit<CursorEvent, "elapsedMs" | "seq" | "tick">,
>(
  recording: LiveGameReplayCursorRecording<CursorEvent>,
  event: EventInput,
  {
    force = false,
    sampleIntervalMs,
    tick = recording.tick,
  }: AppendLiveGameReplayCursorEventOptions,
) {
  const elapsedMs = getGameReplayRecordingElapsedMs(recording);

  if (
    !shouldRecordGameReplayCursorEvent({
      elapsedMs,
      force,
      lastElapsedMs: recording.lastCursorElapsedMs,
      sampleIntervalMs,
    })
  ) {
    return null;
  }

  const recordedEvent = {
    ...event,
    elapsedMs,
    seq: recording.nextCursorSeq,
    tick,
  } as unknown as CursorEvent;

  recording.cursorEvents.push(recordedEvent);
  recording.lastCursorElapsedMs = elapsedMs;
  recording.nextCursorSeq += 1;

  return recordedEvent;
}

export function normalizeGameReplayCursorCoordinate(value: number) {
  return Math.min(1, Math.max(0, Math.round(value * 10_000) / 10_000));
}

export function getGameReplayCursorPositionFromBoardRect({
  clientX,
  clientY,
  rect,
}: {
  clientX: number;
  clientY: number;
  rect: GameReplayBoardRect;
}): GameReplayCursorPosition | null {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;

  if (x < 0 || x > 1 || y < 0 || y > 1) {
    return null;
  }

  return {
    x: normalizeGameReplayCursorCoordinate(x),
    y: normalizeGameReplayCursorCoordinate(y),
  };
}

export function getGameReplayPointerCursorPosition(
  event: GameReplayBoardPointerEvent,
) {
  return getGameReplayCursorPositionFromBoardRect({
    clientX: event.clientX,
    clientY: event.clientY,
    rect: event.currentTarget.getBoundingClientRect(),
  });
}

export function getGameReplayActionCursorPosition(
  event: GameReplayBoardActionEvent | undefined,
  { boardTestId }: { boardTestId: string },
) {
  const boardGrid = event?.currentTarget.closest(`[data-testid="${boardTestId}"]`);
  const boardHost = boardGrid?.parentElement;
  const boardHostWindow = boardHost?.ownerDocument.defaultView;

  if (
    event === undefined ||
    boardHost === undefined ||
    boardHost === null ||
    boardHostWindow === undefined ||
    boardHostWindow === null ||
    !(boardHost instanceof boardHostWindow.HTMLElement)
  ) {
    return undefined;
  }

  return (
    getGameReplayCursorPositionFromBoardRect({
      clientX: event.clientX,
      clientY: event.clientY,
      rect: boardHost.getBoundingClientRect(),
    }) ?? undefined
  );
}
