import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrivateRoom } from "@/lib/multiplayer/room";
import {
  createInitialSpaceInvadersMultiplayerGame,
  type SpaceInvadersMultiplayerGameSnapshot,
} from "@/lib/space-invaders-multiplayer";

import { expectMarkup } from "./game-board-test-utils";
import {
  getMultiplayerRoomGameRenderer,
  renderMultiplayerRoomGame,
} from "./multiplayer-room-game-registry";
import {
  SpaceInvadersMultiplayerRoom,
  createSpaceInvadersMultiplayerInputState,
  handleSpaceInvadersMultiplayerKeyDown,
  handleSpaceInvadersMultiplayerKeyUp,
} from "./space-invaders-multiplayer-room";

const ACTIVE_SPACE_INVADERS_ROOM: PrivateRoom = {
  code: "INV-1",
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
    gameId: "space-invaders",
  },
  status: "running",
};

const RUNNING_SPACE_INVADERS_GAME = {
  gameId: "space-invaders",
  seq: 1,
  serverTimeMs: 1_000,
  snapshot: {
    ...createInitialSpaceInvadersMultiplayerGame({ random: () => 0 }),
    lives: 2,
    score: 420,
    status: "running" as const,
  },
} satisfies SpaceInvadersMultiplayerGameSnapshot;

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

describe("SpaceInvadersMultiplayerRoom", () => {
  beforeEach(() => {
    vi.stubGlobal("HTMLElement", class HTMLElement {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the active board, two ships, role label, and shared stats", () => {
    const markup = renderToStaticMarkup(
      <SpaceInvadersMultiplayerRoom
        activeParticipant={ACTIVE_SPACE_INVADERS_ROOM.participants[0]!}
        game={RUNNING_SPACE_INVADERS_GAME}
        onGameInput={vi.fn()}
        room={ACTIVE_SPACE_INVADERS_ROOM}
      />,
    );

    expectMarkup(markup, [
      'data-testid="space-invaders-multiplayer-room"',
      'data-testid="space-invaders-multiplayer-board-frame"',
      'data-testid="space-invaders-board"',
      'data-testid="space-invaders-multiplayer-status"',
      "Running",
      'data-testid="space-invaders-multiplayer-score"',
      "420",
      'data-testid="space-invaders-multiplayer-lives"',
      "2",
      'data-testid="space-invaders-multiplayer-invaders"',
      'data-testid="space-invaders-multiplayer-active-seat"',
      "Ship A",
      "Ada · Ship A",
      'data-ship-id="ship-a"',
      'data-ship-id="ship-b"',
      "/images/space-invaders/player-ship.png?v=sprite-art-v2",
      "/images/space-invaders/player-b-ship.png?v=sprite-art-v2",
    ]);
    expect(markup.match(/data-testid="space-invaders-player"/g)).toHaveLength(2);
    expect(markup).not.toContain('data-testid="space-invaders-multiplayer-readonly"');
    expect(markup).toContain("max-width:min(100%, calc((100svh - 8rem) * 0.75))");
    expect(markup).not.toContain("h-svh");
  });

  it("renders observer read-only state with shared stats", () => {
    const markup = renderToStaticMarkup(
      <SpaceInvadersMultiplayerRoom
        activeParticipant={ACTIVE_SPACE_INVADERS_ROOM.participants[2]!}
        game={RUNNING_SPACE_INVADERS_GAME}
        onGameInput={vi.fn()}
        room={ACTIVE_SPACE_INVADERS_ROOM}
      />,
    );

    expect(markup).toContain("Katherine · Observer");
    expect(markup).toContain('data-testid="space-invaders-multiplayer-readonly"');
    expect(markup).toContain("Observer view");
    expect(markup).toContain('data-testid="space-invaders-multiplayer-score"');
    expect(markup).toContain('data-testid="space-invaders-multiplayer-active-seat"');
    expect(markup).toContain("Observer");
  });

  it("renders supplied host lifecycle controls", () => {
    const markup = renderToStaticMarkup(
      <SpaceInvadersMultiplayerRoom
        activeParticipant={ACTIVE_SPACE_INVADERS_ROOM.participants[0]!}
        game={RUNNING_SPACE_INVADERS_GAME}
        lifecycleControls={
          <div data-testid="multiplayer-room-host-controls">Host</div>
        }
        onGameInput={vi.fn()}
        room={ACTIVE_SPACE_INVADERS_ROOM}
      />,
    );

    expect(markup).toContain('data-testid="multiplayer-room-host-controls"');
  });

  it("renders authoritative terminal summary details", () => {
    const markup = renderToStaticMarkup(
      <SpaceInvadersMultiplayerRoom
        activeParticipant={ACTIVE_SPACE_INVADERS_ROOM.participants[0]!}
        game={{
          ...RUNNING_SPACE_INVADERS_GAME,
          summary: {
            key: "space-invaders|mode=private-room|board=420x560|aliens=50",
            mode: "private-room",
            outcome: {
              livesRemaining: 2,
              remainingInvaders: 0,
              result: "won",
              score: 420,
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
            settings: ACTIVE_SPACE_INVADERS_ROOM.settings,
            status: "won",
          },
          snapshot: {
            ...RUNNING_SPACE_INVADERS_GAME.snapshot,
            invaders: RUNNING_SPACE_INVADERS_GAME.snapshot.invaders.map(
              (invader) => ({
                ...invader,
                isActive: false,
              }),
            ),
            lives: 2,
            score: 420,
            status: "won",
          },
        }}
        onGameInput={vi.fn()}
        room={ACTIVE_SPACE_INVADERS_ROOM}
      />,
    );

    expect(markup).toContain(
      'data-testid="space-invaders-multiplayer-terminal-message"',
    );
    expect(markup).toContain("Mission won · 420 points");
    expect(markup).toContain(
      'data-testid="space-invaders-multiplayer-terminal-summary"',
    );
    expect(markup).toContain(
      'data-testid="space-invaders-multiplayer-summary-crew"',
    );
    expect(markup).toContain("Ada · Ship A / Grace · Ship B");
    expect(markup).toContain(
      "space-invaders|mode=private-room|board=420x560|aliens=50",
    );
  });

  it("registers and renders through the multiplayer game renderer registry", () => {
    expect(
      getMultiplayerRoomGameRenderer(
        ACTIVE_SPACE_INVADERS_ROOM,
        RUNNING_SPACE_INVADERS_GAME,
      )?.gameId,
    ).toBe("space-invaders");

    const markup = renderToStaticMarkup(
      renderMultiplayerRoomGame({
        activeParticipant: ACTIVE_SPACE_INVADERS_ROOM.participants[0]!,
        game: RUNNING_SPACE_INVADERS_GAME,
        lifecycleControls: null,
        room: ACTIVE_SPACE_INVADERS_ROOM,
        sendGameInput: vi.fn(),
      }),
    );

    expect(markup).toContain('data-testid="space-invaders-multiplayer-room"');
    expect(markup).toContain('data-testid="space-invaders-board"');
  });

  it("sends seated movement and fire payloads from keyboard input", () => {
    const inputState = createSpaceInvadersMultiplayerInputState();
    const submitGameInput = vi.fn();
    const keyDownLeft = createTestKeyboardEvent("ArrowLeft");
    const keyDownFire = createTestKeyboardEvent(" ");
    const keyDownRepeatedFire = createTestKeyboardEvent(" ", { repeat: true });
    const keyUpLeft = createTestKeyboardEvent("ArrowLeft");

    expect(
      handleSpaceInvadersMultiplayerKeyDown({
        canSendGameInput: true,
        event: keyDownLeft,
        gameStatus: "running",
        inputState,
        submitGameInput,
      }),
    ).toBe(true);
    expect(submitGameInput).toHaveBeenLastCalledWith({
      direction: "left",
      type: "space-invaders.setShipDirection",
    });

    expect(
      handleSpaceInvadersMultiplayerKeyDown({
        canSendGameInput: true,
        event: keyDownFire,
        gameStatus: "running",
        inputState,
        submitGameInput,
      }),
    ).toBe(true);
    expect(submitGameInput).toHaveBeenLastCalledWith({
      type: "space-invaders.fire",
    });

    handleSpaceInvadersMultiplayerKeyDown({
      canSendGameInput: true,
      event: keyDownRepeatedFire,
      gameStatus: "running",
      inputState,
      submitGameInput,
    });
    expect(submitGameInput).toHaveBeenCalledTimes(2);

    expect(
      handleSpaceInvadersMultiplayerKeyUp({
        canSendGameInput: true,
        event: keyUpLeft,
        inputState,
        submitGameInput,
      }),
    ).toBe(true);
    expect(submitGameInput).toHaveBeenLastCalledWith({
      direction: null,
      type: "space-invaders.setShipDirection",
    });
    expect(submitGameInput).toHaveBeenCalledTimes(3);
    expect(keyDownLeft.preventDefault).toHaveBeenCalled();
    expect(keyDownFire.preventDefault).toHaveBeenCalled();
    expect(keyUpLeft.preventDefault).toHaveBeenCalled();
  });

  it("does not send observer keyboard input", () => {
    const inputState = createSpaceInvadersMultiplayerInputState();
    const submitGameInput = vi.fn();
    const keyDown = createTestKeyboardEvent("ArrowRight");
    const keyUp = createTestKeyboardEvent("ArrowRight");

    expect(
      handleSpaceInvadersMultiplayerKeyDown({
        canSendGameInput: false,
        event: keyDown,
        gameStatus: "running",
        inputState,
        submitGameInput,
      }),
    ).toBe(false);
    expect(
      handleSpaceInvadersMultiplayerKeyUp({
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
