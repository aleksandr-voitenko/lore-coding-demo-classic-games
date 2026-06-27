import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAsteroidsTickDelay,
  type AsteroidsControlInput,
} from "@/lib/asteroids-game-engine";
import {
  createInitialAsteroidsMultiplayerGame,
  projectAsteroidsMultiplayerGame,
  startAsteroidsMultiplayerGame,
  type AsteroidsMultiplayerGameSnapshot,
} from "@/lib/asteroids-multiplayer";
import type { PrivateRoom } from "@/lib/multiplayer/room";

import { expectMarkup } from "./game-board-test-utils";
import {
  AsteroidsMultiplayerRoom,
  createAsteroidsMultiplayerInputState,
  getAsteroidsMultiplayerProjectionFrameKey,
  getAsteroidsMultiplayerProjectionHeldInputs,
  handleAsteroidsMultiplayerKeyDown,
  handleAsteroidsMultiplayerKeyUp,
  isAsteroidsMultiplayerProjectionFrameAdvanced,
  pressAsteroidsMultiplayerInputKey,
  projectAsteroidsMultiplayerSnapshot,
  releaseAsteroidsMultiplayerInputKey,
  resetAsteroidsMultiplayerInputState,
} from "./asteroids-multiplayer-room";
import {
  MultiplayerRoomGameRendererView,
  getMultiplayerRoomGameRenderer,
} from "./multiplayer-room-game-registry";

const ACTIVE_ASTEROIDS_ROOM: PrivateRoom = {
  code: "AST-1",
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
      id: "ship-a",
      label: "Ship A",
      occupiedByParticipantId: "host-participant",
      required: true,
    },
    {
      id: "ship-b",
      label: "Ship B",
      occupiedByParticipantId: "guest-participant",
      required: true,
    },
  ],
  settings: {
    gameId: "asteroids",
    parameters: {
      "asteroids-difficulty": "hard",
    },
  },
  status: "running",
};

const RUNNING_ASTEROIDS_GAME = {
  gameId: "asteroids",
  heldInputs: {},
  seq: 1,
  serverTimeMs: 1_000,
  snapshot: {
    ...startAsteroidsMultiplayerGame(
      createInitialAsteroidsMultiplayerGame({ random: () => 0 }),
    ),
    lives: 2,
    score: 1_250,
    status: "running" as const,
    wave: 3,
  },
} satisfies AsteroidsMultiplayerGameSnapshot;

const RELEASED_ASTEROIDS_CONTROLS = {
  rotateLeft: false,
  rotateRight: false,
  thrust: false,
} satisfies AsteroidsControlInput;

const THRUSTING_ASTEROIDS_CONTROLS = {
  rotateLeft: false,
  rotateRight: true,
  thrust: true,
} satisfies AsteroidsControlInput;

type TestKeyboardEvent = Pick<
  KeyboardEvent,
  "key" | "preventDefault" | "repeat" | "target"
>;

function createTestKeyboardEvent(
  key: string,
  options: Partial<TestKeyboardEvent> = {},
): TestKeyboardEvent {
  return {
    key,
    preventDefault: vi.fn(),
    repeat: false,
    target: null,
    ...options,
  };
}

describe("AsteroidsMultiplayerRoom", () => {
  beforeEach(() => {
    vi.stubGlobal("HTMLElement", class HTMLElement {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the active board, two ships, role label, and shared stats", () => {
    const markup = renderToStaticMarkup(
      <AsteroidsMultiplayerRoom
        activeParticipant={ACTIVE_ASTEROIDS_ROOM.participants[0]!}
        game={RUNNING_ASTEROIDS_GAME}
        onGameInput={vi.fn()}
        room={ACTIVE_ASTEROIDS_ROOM}
      />,
    );

    expectMarkup(markup, [
      'data-testid="asteroids-multiplayer-room"',
      'data-testid="asteroids-multiplayer-board-frame"',
      'data-testid="asteroids-board"',
      'data-testid="asteroids-multiplayer-status"',
      "Running",
      'data-testid="asteroids-multiplayer-score"',
      "1250",
      'data-testid="asteroids-multiplayer-lives"',
      "2",
      'data-testid="asteroids-multiplayer-wave"',
      "3",
      'data-testid="asteroids-multiplayer-active-seat"',
      "Ship A",
      "Ada · Ship A",
      'data-ship-id="ship-a"',
      'data-ship-id="ship-b"',
      'data-ship-label="Ship A"',
      'data-ship-label="Ship B"',
    ]);
    expect(markup.match(/data-testid="asteroids-ship"/g)).toHaveLength(2);
    expect(markup).not.toContain('data-testid="asteroids-multiplayer-readonly"');
    expect(markup).toContain(
      "max-width:min(100%, calc((100svh - 8rem) * 1.3333333333333333))",
    );
  });

  it("renders observer read-only state with shared stats", () => {
    const markup = renderToStaticMarkup(
      <AsteroidsMultiplayerRoom
        activeParticipant={ACTIVE_ASTEROIDS_ROOM.participants[2]!}
        game={RUNNING_ASTEROIDS_GAME}
        onGameInput={vi.fn()}
        room={ACTIVE_ASTEROIDS_ROOM}
      />,
    );

    expect(markup).toContain("Katherine · Observer");
    expect(markup).toContain('data-testid="asteroids-multiplayer-readonly"');
    expect(markup).toContain("Observer view");
    expect(markup).toContain('data-testid="asteroids-multiplayer-score"');
    expect(markup).toContain('data-testid="asteroids-multiplayer-active-seat"');
    expect(markup).toContain("Observer");
  });

  it("renders supplied host lifecycle controls", () => {
    const markup = renderToStaticMarkup(
      <AsteroidsMultiplayerRoom
        activeParticipant={ACTIVE_ASTEROIDS_ROOM.participants[0]!}
        game={RUNNING_ASTEROIDS_GAME}
        lifecycleControls={
          <div data-testid="multiplayer-room-host-controls">Host</div>
        }
        onGameInput={vi.fn()}
        room={ACTIVE_ASTEROIDS_ROOM}
      />,
    );

    expect(markup).toContain('data-testid="multiplayer-room-host-controls"');
  });

  it("treats only advanced projection ticks as reconciliation-worthy", () => {
    const projectionSnapshot = {
      activeShipSeat: "ship-a",
      game: RUNNING_ASTEROIDS_GAME,
      getLocalControls: () => RELEASED_ASTEROIDS_CONTROLS,
    } as const;

    expect(
      isAsteroidsMultiplayerProjectionFrameAdvanced(projectionSnapshot, 0),
    ).toBe(false);
    expect(
      isAsteroidsMultiplayerProjectionFrameAdvanced(
        projectionSnapshot,
        getAsteroidsTickDelay(),
      ),
    ).toBe(true);
  });

  it("renders authoritative terminal summary details", () => {
    const markup = renderToStaticMarkup(
      <AsteroidsMultiplayerRoom
        activeParticipant={ACTIVE_ASTEROIDS_ROOM.participants[0]!}
        game={{
          ...RUNNING_ASTEROIDS_GAME,
          summary: {
            key: "asteroids|mode=private-room|difficulty=hard",
            mode: "private-room",
            outcome: {
              livesRemaining: 0,
              score: 1_250,
              wave: 3,
            },
            seats: [
              {
                id: "ship-a",
                label: "Ship A",
                participant: {
                  displayName: "Ada",
                  id: "host-participant",
                  role: "host",
                  userId: "user-1",
                },
              },
              {
                id: "ship-b",
                label: "Ship B",
                participant: {
                  displayName: "Grace",
                  id: "guest-participant",
                  role: "player",
                  userId: null,
                },
              },
            ],
            settings: ACTIVE_ASTEROIDS_ROOM.settings,
            status: "lost",
          },
          snapshot: {
            ...RUNNING_ASTEROIDS_GAME.snapshot,
            lives: 0,
            score: 1_250,
            status: "lost",
            wave: 3,
          },
        }}
        onGameInput={vi.fn()}
        room={ACTIVE_ASTEROIDS_ROOM}
      />,
    );

    expect(markup).toContain(
      'data-testid="asteroids-multiplayer-terminal-message"',
    );
    expect(markup).toContain("Run lost · 1250 points");
    expect(markup).toContain(
      'data-testid="asteroids-multiplayer-terminal-summary"',
    );
    expect(markup).toContain(
      'data-testid="asteroids-multiplayer-summary-crew"',
    );
    expect(markup).toContain("Ada · Ship A / Grace · Ship B");
    expect(markup).toContain("asteroids|mode=private-room|difficulty=hard");
  });

  it("registers and renders through the multiplayer game renderer registry", () => {
    const renderer = getMultiplayerRoomGameRenderer(
      ACTIVE_ASTEROIDS_ROOM,
      RUNNING_ASTEROIDS_GAME,
    );

    expect(renderer?.gameId).toBe("asteroids");

    if (renderer === null) {
      throw new Error("Expected Asteroids to have a room game renderer");
    }

    const markup = renderToStaticMarkup(
      <MultiplayerRoomGameRendererView
        activeParticipant={ACTIVE_ASTEROIDS_ROOM.participants[0]!}
        game={RUNNING_ASTEROIDS_GAME}
        lifecycleControls={null}
        renderer={renderer}
        room={ACTIVE_ASTEROIDS_ROOM}
        sendGameInput={vi.fn()}
      />,
    );

    expect(markup).toContain('data-testid="asteroids-multiplayer-room"');
    expect(markup).toContain('data-testid="asteroids-board"');
  });

  it("projects running board state from server held inputs", () => {
    const game = {
      ...RUNNING_ASTEROIDS_GAME,
      heldInputs: {
        "ship-b": {
          rotateRight: true,
          thrust: true,
        },
      },
    } satisfies AsteroidsMultiplayerGameSnapshot;
    const elapsedMs = getAsteroidsTickDelay();
    const projected = projectAsteroidsMultiplayerSnapshot(
      {
        activeShipSeat: null,
        game,
        getLocalControls: () => THRUSTING_ASTEROIDS_CONTROLS,
      },
      elapsedMs,
    );

    expect(projected).toEqual(
      projectAsteroidsMultiplayerGame(
        game.snapshot,
        game.heldInputs,
        elapsedMs,
      ),
    );
    expect(projected.ships["ship-a"].ship.isThrusting).toBe(false);
    expect(projected.ships["ship-b"].ship.isThrusting).toBe(true);
    expect(projected.ships["ship-b"].ship.angle).not.toBe(
      RUNNING_ASTEROIDS_GAME.snapshot.ships["ship-b"].ship.angle,
    );
  });

  it("predicts active-seat controls while preserving sparse server inputs", () => {
    const game = {
      ...RUNNING_ASTEROIDS_GAME,
      heldInputs: {
        "ship-b": {
          rotateLeft: true,
          thrust: true,
        },
      },
    } satisfies AsteroidsMultiplayerGameSnapshot;
    const elapsedMs = getAsteroidsTickDelay();
    const heldInputs = getAsteroidsMultiplayerProjectionHeldInputs(
      game.heldInputs,
      "ship-a",
      THRUSTING_ASTEROIDS_CONTROLS,
    );
    const projected = projectAsteroidsMultiplayerSnapshot(
      {
        activeShipSeat: "ship-a",
        game,
        getLocalControls: () => THRUSTING_ASTEROIDS_CONTROLS,
      },
      elapsedMs,
    );

    expect(heldInputs).toEqual({
      "ship-a": {
        rotateRight: true,
        thrust: true,
      },
      "ship-b": {
        rotateLeft: true,
        thrust: true,
      },
    });
    expect(projected.ships["ship-a"].ship.isThrusting).toBe(true);
    expect(projected.ships["ship-a"].ship.angle).not.toBe(
      RUNNING_ASTEROIDS_GAME.snapshot.ships["ship-a"].ship.angle,
    );
    expect(projected.ships["ship-b"].ship.isThrusting).toBe(true);
    expect(projected.ships["ship-b"].ship.angle).not.toBe(
      RUNNING_ASTEROIDS_GAME.snapshot.ships["ship-b"].ship.angle,
    );
    expect(projected.ships["ship-a"].bullets).toEqual(
      RUNNING_ASTEROIDS_GAME.snapshot.ships["ship-a"].bullets,
    );
    expect(projected.nextBulletId).toBe(
      RUNNING_ASTEROIDS_GAME.snapshot.nextBulletId,
    );
  });

  it("uses server held inputs for observers and clears active local prediction", () => {
    const heldInputs = {
      "ship-a": {
        thrust: true,
      },
      "ship-b": {
        rotateLeft: true,
      },
    };
    const observerHeldInputs = getAsteroidsMultiplayerProjectionHeldInputs(
      heldInputs,
      null,
      THRUSTING_ASTEROIDS_CONTROLS,
    );
    const clearedActiveHeldInputs = getAsteroidsMultiplayerProjectionHeldInputs(
      heldInputs,
      "ship-a",
      RELEASED_ASTEROIDS_CONTROLS,
    );
    const observerProjected = projectAsteroidsMultiplayerSnapshot(
      {
        activeShipSeat: null,
        game: {
          ...RUNNING_ASTEROIDS_GAME,
          heldInputs,
        },
        getLocalControls: () => THRUSTING_ASTEROIDS_CONTROLS,
      },
      getAsteroidsTickDelay(),
    );
    const serverProjected = projectAsteroidsMultiplayerGame(
      RUNNING_ASTEROIDS_GAME.snapshot,
      heldInputs,
      getAsteroidsTickDelay(),
    );

    expect(observerHeldInputs).toBe(heldInputs);
    expect(clearedActiveHeldInputs).toEqual({
      "ship-b": {
        rotateLeft: true,
      },
    });
    expect(observerProjected.ships["ship-a"].ship).toEqual(
      serverProjected.ships["ship-a"].ship,
    );
    expect(observerProjected.ships["ship-a"].ship.isThrusting).toBe(true);
  });

  it("keys active-seat projection frames by local controls", () => {
    let localControls: AsteroidsControlInput = THRUSTING_ASTEROIDS_CONTROLS;
    const activeSnapshot = {
      activeShipSeat: "ship-a" as const,
      game: RUNNING_ASTEROIDS_GAME,
      getLocalControls: () => localControls,
    };
    const thrustingKey = getAsteroidsMultiplayerProjectionFrameKey(
      activeSnapshot,
      0,
    );

    localControls = RELEASED_ASTEROIDS_CONTROLS;

    expect(
      getAsteroidsMultiplayerProjectionFrameKey(activeSnapshot, 0),
    ).not.toBe(thrustingKey);

    const observerSnapshot = {
      ...activeSnapshot,
      activeShipSeat: null,
    };
    const observerKey = getAsteroidsMultiplayerProjectionFrameKey(
      observerSnapshot,
      0,
    );

    localControls = THRUSTING_ASTEROIDS_CONTROLS;

    expect(
      getAsteroidsMultiplayerProjectionFrameKey(observerSnapshot, 0),
    ).toBe(observerKey);
  });

  it("sends seated controls and fire payloads from keyboard input", () => {
    const inputState = createAsteroidsMultiplayerInputState();
    const submitGameInput = vi.fn();
    const keyDownLeft = createTestKeyboardEvent("ArrowLeft");
    const keyDownThrust = createTestKeyboardEvent("ArrowUp");
    const keyDownFire = createTestKeyboardEvent(" ");
    const keyDownRepeatedFire = createTestKeyboardEvent(" ", { repeat: true });
    const keyUpLeft = createTestKeyboardEvent("ArrowLeft");

    expect(
      handleAsteroidsMultiplayerKeyDown({
        canSendGameInput: true,
        event: keyDownLeft,
        gameStatus: "running",
        inputState,
        submitGameInput,
      }),
    ).toBe(true);
    expect(submitGameInput).toHaveBeenLastCalledWith({
      controls: {
        rotateLeft: true,
        rotateRight: false,
        thrust: false,
      },
      type: "asteroids.setShipControls",
    });

    expect(
      handleAsteroidsMultiplayerKeyDown({
        canSendGameInput: true,
        event: keyDownThrust,
        gameStatus: "running",
        inputState,
        submitGameInput,
      }),
    ).toBe(true);
    expect(submitGameInput).toHaveBeenLastCalledWith({
      controls: {
        rotateLeft: true,
        rotateRight: false,
        thrust: true,
      },
      type: "asteroids.setShipControls",
    });

    expect(
      handleAsteroidsMultiplayerKeyDown({
        canSendGameInput: true,
        event: keyDownFire,
        gameStatus: "running",
        inputState,
        submitGameInput,
      }),
    ).toBe(true);
    expect(submitGameInput).toHaveBeenLastCalledWith({
      type: "asteroids.fire",
    });

    handleAsteroidsMultiplayerKeyDown({
      canSendGameInput: true,
      event: keyDownRepeatedFire,
      gameStatus: "running",
      inputState,
      submitGameInput,
    });
    expect(submitGameInput).toHaveBeenCalledTimes(3);

    expect(
      handleAsteroidsMultiplayerKeyUp({
        canSendGameInput: true,
        event: keyUpLeft,
        inputState,
        submitGameInput,
      }),
    ).toBe(true);
    expect(submitGameInput).toHaveBeenLastCalledWith({
      controls: {
        rotateLeft: false,
        rotateRight: false,
        thrust: true,
      },
      type: "asteroids.setShipControls",
    });
    expect(submitGameInput).toHaveBeenCalledTimes(4);
    expect(keyDownLeft.preventDefault).toHaveBeenCalled();
    expect(keyDownThrust.preventDefault).toHaveBeenCalled();
    expect(keyDownFire.preventDefault).toHaveBeenCalled();
    expect(keyUpLeft.preventDefault).toHaveBeenCalled();
  });

  it("does not send observer keyboard input", () => {
    const inputState = createAsteroidsMultiplayerInputState();
    const submitGameInput = vi.fn();
    const keyDown = createTestKeyboardEvent("ArrowRight");
    const keyUp = createTestKeyboardEvent("ArrowRight");

    expect(
      handleAsteroidsMultiplayerKeyDown({
        canSendGameInput: false,
        event: keyDown,
        gameStatus: "running",
        inputState,
        submitGameInput,
      }),
    ).toBe(false);
    expect(
      handleAsteroidsMultiplayerKeyUp({
        canSendGameInput: false,
        event: keyUp,
        inputState,
        submitGameInput,
      }),
    ).toBe(false);

    expect(submitGameInput).not.toHaveBeenCalled();
    expect(keyDown.preventDefault).not.toHaveBeenCalled();
    expect(keyUp.preventDefault).not.toHaveBeenCalled();
  });
});

describe("Asteroids multiplayer input transitions", () => {
  it("sends only changed controls while suppressing repeated physical keys", () => {
    const state = createAsteroidsMultiplayerInputState();

    expect(pressAsteroidsMultiplayerInputKey(state, "ArrowLeft")).toEqual({
      controls: {
        rotateLeft: true,
        rotateRight: false,
        thrust: false,
      },
      handled: true,
      shouldSend: true,
    });
    expect(pressAsteroidsMultiplayerInputKey(state, "ArrowLeft")).toEqual({
      controls: {
        rotateLeft: true,
        rotateRight: false,
        thrust: false,
      },
      handled: true,
      shouldSend: false,
    });
    expect(pressAsteroidsMultiplayerInputKey(state, "a")).toEqual({
      controls: {
        rotateLeft: true,
        rotateRight: false,
        thrust: false,
      },
      handled: true,
      shouldSend: false,
    });
  });

  it("tracks simultaneous rotation and thrust until each held key is released", () => {
    const state = createAsteroidsMultiplayerInputState();

    pressAsteroidsMultiplayerInputKey(state, "ArrowLeft");
    expect(pressAsteroidsMultiplayerInputKey(state, "w")).toEqual({
      controls: {
        rotateLeft: true,
        rotateRight: false,
        thrust: true,
      },
      handled: true,
      shouldSend: true,
    });
    expect(releaseAsteroidsMultiplayerInputKey(state, "ArrowLeft")).toEqual({
      controls: {
        rotateLeft: false,
        rotateRight: false,
        thrust: true,
      },
      handled: true,
      shouldSend: true,
    });
    expect(releaseAsteroidsMultiplayerInputKey(state, "w")).toEqual({
      controls: {
        rotateLeft: false,
        rotateRight: false,
        thrust: false,
      },
      handled: true,
      shouldSend: true,
    });
  });

  it("clears held controls on reset only when a control is active", () => {
    const state = createAsteroidsMultiplayerInputState();

    expect(resetAsteroidsMultiplayerInputState(state)).toEqual({
      controls: {
        rotateLeft: false,
        rotateRight: false,
        thrust: false,
      },
      handled: false,
      shouldSend: false,
    });

    pressAsteroidsMultiplayerInputKey(state, "d");

    expect(resetAsteroidsMultiplayerInputState(state)).toEqual({
      controls: {
        rotateLeft: false,
        rotateRight: false,
        thrust: false,
      },
      handled: true,
      shouldSend: true,
    });
  });
});
