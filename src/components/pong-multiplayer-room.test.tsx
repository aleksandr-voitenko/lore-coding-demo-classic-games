import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { MultiplayerRoomGameSnapshot } from "@/lib/multiplayer/protocol";
import type { PrivateRoom } from "@/lib/multiplayer/room";
import {
  createInitialPongGame,
  pausePongGame,
  startPongGame,
} from "@/lib/pong-game-engine";

import { expectMarkup } from "./game-board-test-utils";
import {
  PongMultiplayerRoom,
  createPongMultiplayerInputState,
  getPongMultiplayerBoardFrameMaxWidth,
  pressPongMultiplayerInputKey,
  releasePongMultiplayerInputKey,
  resetPongMultiplayerInputState,
} from "./pong-multiplayer-room";

const ACTIVE_PONG_ROOM: PrivateRoom = {
  code: "PONG-1",
  hostParticipantId: "host-participant",
  participants: [
    {
      displayName: "Ada",
      id: "host-participant",
      role: "host",
      userId: "user-1",
    },
    {
      displayName: "Grace",
      id: "guest-participant",
      role: "player",
      userId: null,
    },
    {
      displayName: "Katherine",
      id: "observer-participant",
      role: "observer",
      userId: null,
    },
  ],
  seats: [
    {
      id: "left",
      label: "Left Paddle",
      occupiedByParticipantId: "host-participant",
      required: true,
    },
    {
      id: "right",
      label: "Right Paddle",
      occupiedByParticipantId: "guest-participant",
      required: true,
    },
  ],
  settings: {
    gameId: "pong",
    parameters: {
      "pong-target": "5",
    },
  },
  status: "running",
};

const RUNNING_PONG_GAME = {
  gameId: "pong",
  heldInputs: {},
  seq: 1,
  serverTimeMs: 1_000,
  snapshot: startPongGame(createInitialPongGame()),
} satisfies MultiplayerRoomGameSnapshot;

describe("PongMultiplayerRoom", () => {
  it("renders the active board, score, target, and seated participant role", () => {
    const markup = renderToStaticMarkup(
      <PongMultiplayerRoom
        activeParticipant={ACTIVE_PONG_ROOM.participants[0]!}
        game={RUNNING_PONG_GAME}
        onGameInput={vi.fn()}
        room={ACTIVE_PONG_ROOM}
      />,
    );

    expectMarkup(markup, [
      'data-testid="pong-multiplayer-room"',
      'data-testid="pong-multiplayer-board-frame"',
      'data-testid="pong-board"',
      'data-testid="pong-multiplayer-status"',
      "Running",
      'data-testid="pong-multiplayer-score-left"',
      'data-testid="pong-multiplayer-score-right"',
      'data-testid="pong-multiplayer-target"',
      "Ada · Left Paddle",
    ]);
    expect(markup).not.toContain('data-testid="pong-multiplayer-readonly"');
    expect(markup).not.toContain("transition-property:left, top");
    expect(markup).not.toContain("will-change:left, top");
    expect(markup).toContain("max-width:min(100%, calc((100svh - 8rem) * 0.75))");
  });

  it("renders observer read-only state without a serve action", () => {
    const markup = renderToStaticMarkup(
      <PongMultiplayerRoom
        activeParticipant={ACTIVE_PONG_ROOM.participants[2]!}
        game={{
          ...RUNNING_PONG_GAME,
          snapshot: createInitialPongGame({ initialServeSide: "left" }),
        }}
        onGameInput={vi.fn()}
        room={ACTIVE_PONG_ROOM}
      />,
    );

    expect(markup).toContain("Katherine · Observer");
    expect(markup).toContain('data-testid="pong-multiplayer-readonly"');
    expect(markup).toContain("Observer view");
    expect(markup).not.toContain('data-testid="pong-multiplayer-serve-button"');
  });

  it("renders supplied host lifecycle controls", () => {
    const markup = renderToStaticMarkup(
      <PongMultiplayerRoom
        activeParticipant={ACTIVE_PONG_ROOM.participants[0]!}
        game={RUNNING_PONG_GAME}
        lifecycleControls={<div data-testid="multiplayer-room-host-controls">Host</div>}
        onGameInput={vi.fn()}
        room={ACTIVE_PONG_ROOM}
      />,
    );

    expect(markup).toContain('data-testid="multiplayer-room-host-controls"');
  });

  it("renders ready, paused, and terminal state copy", () => {
    const readyMarkup = renderToStaticMarkup(
      <PongMultiplayerRoom
        activeParticipant={ACTIVE_PONG_ROOM.participants[0]!}
        game={{
          ...RUNNING_PONG_GAME,
          snapshot: createInitialPongGame({ initialServeSide: "left" }),
        }}
        onGameInput={vi.fn()}
        room={ACTIVE_PONG_ROOM}
      />,
    );
    const pausedMarkup = renderToStaticMarkup(
      <PongMultiplayerRoom
        activeParticipant={ACTIVE_PONG_ROOM.participants[0]!}
        game={{
          ...RUNNING_PONG_GAME,
          snapshot: pausePongGame(RUNNING_PONG_GAME.snapshot),
        }}
        onGameInput={vi.fn()}
        room={ACTIVE_PONG_ROOM}
      />,
    );
    const terminalMarkup = renderToStaticMarkup(
      <PongMultiplayerRoom
        activeParticipant={ACTIVE_PONG_ROOM.participants[1]!}
        game={{
          ...RUNNING_PONG_GAME,
          snapshot: {
            ...RUNNING_PONG_GAME.snapshot,
            status: "lost",
          },
        }}
        onGameInput={vi.fn()}
        room={ACTIVE_PONG_ROOM}
      />,
    );

    expect(readyMarkup).toContain('data-testid="pong-multiplayer-ready-message"');
    expect(readyMarkup).toContain('data-testid="pong-multiplayer-serve-key-hint"');
    expect(readyMarkup).toContain("Press Space or Enter to serve");
    expect(readyMarkup).not.toContain("transition-property:left, top");
    expect(pausedMarkup).toContain('data-testid="pong-multiplayer-paused-message"');
    expect(terminalMarkup).toContain('data-testid="pong-multiplayer-terminal-message"');
    expect(terminalMarkup).toContain("Right paddle wins the match");
  });
});

describe("Pong multiplayer board sizing", () => {
  it("caps board width from viewport height and game aspect ratio", () => {
    expect(getPongMultiplayerBoardFrameMaxWidth(RUNNING_PONG_GAME)).toBe(
      "min(100%, calc((100svh - 8rem) * 0.75))",
    );
  });
});

describe("Pong multiplayer input transitions", () => {
  it("sends only direction changes while suppressing physical key repeat", () => {
    const state = createPongMultiplayerInputState();

    expect(pressPongMultiplayerInputKey(state, "ArrowUp")).toEqual({
      direction: "up",
      handled: true,
      shouldSend: true,
    });
    expect(pressPongMultiplayerInputKey(state, "ArrowUp")).toEqual({
      direction: "up",
      handled: true,
      shouldSend: false,
    });
    expect(pressPongMultiplayerInputKey(state, "w")).toEqual({
      direction: "up",
      handled: true,
      shouldSend: false,
    });
  });

  it("falls back to the opposite held key and clears on final release", () => {
    const state = createPongMultiplayerInputState();

    pressPongMultiplayerInputKey(state, "ArrowUp");
    expect(pressPongMultiplayerInputKey(state, "ArrowDown")).toEqual({
      direction: "down",
      handled: true,
      shouldSend: true,
    });
    expect(releasePongMultiplayerInputKey(state, "ArrowDown")).toEqual({
      direction: "up",
      handled: true,
      shouldSend: true,
    });
    expect(releasePongMultiplayerInputKey(state, "ArrowUp")).toEqual({
      direction: null,
      handled: true,
      shouldSend: true,
    });
  });

  it("clears held movement on reset only when a direction is active", () => {
    const state = createPongMultiplayerInputState();

    expect(resetPongMultiplayerInputState(state)).toEqual({
      direction: null,
      handled: false,
      shouldSend: false,
    });

    pressPongMultiplayerInputKey(state, "s");

    expect(resetPongMultiplayerInputState(state)).toEqual({
      direction: null,
      handled: true,
      shouldSend: true,
    });
  });
});
