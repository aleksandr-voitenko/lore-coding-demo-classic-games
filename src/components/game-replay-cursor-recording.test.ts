import { describe, expect, it } from "vitest";

import {
  appendLiveGameReplayCursorEvent,
  createLiveGameReplayCursorRecordingFields,
  getGameReplayActionCursorPosition,
  getGameReplayCursorPositionFromBoardRect,
  getGameReplayPointerCursorPosition,
  normalizeGameReplayCursorCoordinate,
  type LiveGameReplayCursorRecordedEvent,
} from "@/components/game-replay-cursor-recording";
import type { GameReplayActiveClock } from "@/lib/game-replay";

type TestCursorEvent = LiveGameReplayCursorRecordedEvent & {
  type: "cursorMove";
};

function createRecording({
  clock = {
    activeElapsedMs: 100,
    lastStartedAtMs: null,
  },
  tick = 4,
}: {
  clock?: GameReplayActiveClock;
  tick?: number;
} = {}) {
  return {
    clock,
    ...createLiveGameReplayCursorRecordingFields<TestCursorEvent>(),
    tick,
  };
}

describe("game replay cursor recording", () => {
  it("normalizes board-local cursor coordinates to four decimals inside [0, 1]", () => {
    expect(normalizeGameReplayCursorCoordinate(0.123456)).toBe(0.1235);
    expect(normalizeGameReplayCursorCoordinate(-0.25)).toBe(0);
    expect(normalizeGameReplayCursorCoordinate(1.25)).toBe(1);
  });

  it("maps client coordinates to board-local cursor positions", () => {
    const rect = {
      height: 100,
      left: 10,
      top: 20,
      width: 200,
    };

    expect(
      getGameReplayCursorPositionFromBoardRect({
        clientX: 60,
        clientY: 95,
        rect,
      }),
    ).toEqual({
      x: 0.25,
      y: 0.75,
    });
    expect(
      getGameReplayCursorPositionFromBoardRect({
        clientX: 9,
        clientY: 95,
        rect,
      }),
    ).toBeNull();
    expect(
      getGameReplayCursorPositionFromBoardRect({
        clientX: 60,
        clientY: 95,
        rect: {
          ...rect,
          width: 0,
        },
      }),
    ).toBeNull();
  });

  it("extracts cursor positions from board pointer and action events", () => {
    const rect = {
      height: 100,
      left: 10,
      top: 20,
      width: 200,
    };
    class TestHTMLElement {
      readonly ownerDocument = {
        defaultView: {
          HTMLElement: TestHTMLElement,
        },
      };

      getBoundingClientRect() {
        return rect;
      }
    }

    const boardHost = new TestHTMLElement() as unknown as HTMLElement;
    const boardGrid = {
      parentElement: boardHost,
    };
    const currentTarget = {
      closest: (selector: string) =>
        selector === '[data-testid="simon-board"]' ? boardGrid : null,
    } as unknown as Element;

    expect(
      getGameReplayPointerCursorPosition({
        clientX: 60,
        clientY: 95,
        currentTarget: {
          getBoundingClientRect: () => rect,
        },
      }),
    ).toEqual({
      x: 0.25,
      y: 0.75,
    });
    expect(
      getGameReplayActionCursorPosition(
        {
          clientX: 110,
          clientY: 45,
          currentTarget,
        },
        { boardTestId: "simon-board" },
      ),
    ).toEqual({
      x: 0.5,
      y: 0.25,
    });
    expect(
      getGameReplayActionCursorPosition(undefined, {
        boardTestId: "simon-board",
      }),
    ).toBeUndefined();
  });

  it("appends cursor events with independent sequencing and sampled elapsed timing", () => {
    const recording = createRecording();

    expect(
      appendLiveGameReplayCursorEvent(
        recording,
        {
          type: "cursorMove",
          x: 0.25,
          y: 0.75,
        },
        { sampleIntervalMs: 50 },
      ),
    ).toEqual({
      elapsedMs: 100,
      seq: 0,
      tick: 4,
      type: "cursorMove",
      x: 0.25,
      y: 0.75,
    });

    recording.clock.activeElapsedMs = 120;

    expect(
      appendLiveGameReplayCursorEvent(
        recording,
        {
          type: "cursorMove",
          x: 0.5,
          y: 0.25,
        },
        { sampleIntervalMs: 50 },
      ),
    ).toBeNull();

    expect(
      appendLiveGameReplayCursorEvent(
        recording,
        {
          type: "cursorMove",
          x: 0.5,
          y: 0.25,
        },
        {
          force: true,
          sampleIntervalMs: 50,
          tick: 9,
        },
      ),
    ).toEqual({
      elapsedMs: 120,
      seq: 1,
      tick: 9,
      type: "cursorMove",
      x: 0.5,
      y: 0.25,
    });
    expect(recording.cursorEvents).toHaveLength(2);
    expect(recording.lastCursorElapsedMs).toBe(120);
    expect(recording.nextCursorSeq).toBe(2);
  });
});
