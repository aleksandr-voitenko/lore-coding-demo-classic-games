import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BATTLE_CITY_TICK_MS,
  type BattleCityMultiplayerGameState,
} from "@/lib/battle-city-game-engine";
import {
  createStartedBattleCityMultiplayerGame,
  type BattleCityMultiplayerGameSnapshot,
  type BattleCityMultiplayerHeldInputs,
} from "@/lib/battle-city-multiplayer";
import type { PrivateRoom } from "@/lib/multiplayer/room";

import {
  MultiplayerRoomGameRendererView,
  getMultiplayerRoomGameRenderer,
} from "./multiplayer-room-game-registry";
import {
  BattleCityMultiplayerRoom,
  createBattleCityMultiplayerInputState,
  getBattleCityMultiplayerProjectionHeldInputs,
  handleBattleCityMultiplayerKeyDown,
  handleBattleCityMultiplayerKeyUp,
  isBattleCityMultiplayerProjectionFrameAdvanced,
  projectBattleCityMultiplayerBoardGame,
} from "./battle-city-multiplayer-room";

const ACTIVE_BATTLE_CITY_ROOM: PrivateRoom = {
  code: "TANK-1",
  hostParticipantId: "host-participant",
  matchId: 1,
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
      id: "player-1",
      label: "Player 1",
      occupiedByParticipantId: "host-participant",
      required: true,
    },
    {
      id: "player-2",
      label: "Player 2",
      occupiedByParticipantId: "guest-participant",
      required: true,
    },
  ],
  settings: {
    gameId: "battle-city",
  },
  status: "running",
};

function createRunningBattleCityMultiplayerGame(): BattleCityMultiplayerGameState {
  const game = createStartedBattleCityMultiplayerGame();

  return {
    ...game,
    lives: 3,
    player: {
      ...game.player,
      invulnerabilityTicks: 0,
      phase: "active",
      phaseTicks: 0,
    },
    player2: {
      ...game.player2,
      invulnerabilityTicks: 0,
      phase: "active",
      phaseTicks: 0,
    },
    player2Lives: 3,
    player2Score: 900,
    score: 1_200,
    status: "running",
  };
}

const RUNNING_BATTLE_CITY_GAME = {
  gameId: "battle-city",
  heldInputs: {},
  matchId: 1,
  seq: 1,
  serverTimeMs: 1_000,
  snapshot: createRunningBattleCityMultiplayerGame(),
} satisfies BattleCityMultiplayerGameSnapshot;

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

describe("BattleCityMultiplayerRoom", () => {
  beforeEach(() => {
    vi.stubGlobal("HTMLElement", class HTMLElement {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders both players, authoritative stats, role, and placeholder art", () => {
    const markup = renderToStaticMarkup(
      <BattleCityMultiplayerRoom
        activeParticipant={ACTIVE_BATTLE_CITY_ROOM.participants[0]!}
        game={RUNNING_BATTLE_CITY_GAME}
        onGameInput={vi.fn()}
        room={ACTIVE_BATTLE_CITY_ROOM}
      />,
    );

    expect(markup).toContain('data-testid="battle-city-multiplayer-room"');
    expect(markup).toContain('data-testid="battle-city-multiplayer-board-frame"');
    expect(markup).toContain('data-testid="battle-city-board"');
    expect(markup).toContain('data-testid="battle-city-player"');
    expect(markup).toContain('data-testid="battle-city-player-2"');
    expect(markup).toContain('data-player-id="player1"');
    expect(markup).toContain('data-player-id="player2"');
    expect(markup).toContain(
      "/images/battle-city/tank-player-2-tier-0.png?v=modern-v1",
    );
    expect(markup).toContain('data-testid="battle-city-multiplayer-status"');
    expect(markup).toContain("Running");
    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-player-1-score"',
    );
    expect(markup).toContain("1,200");
    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-player-2-score"',
    );
    expect(markup).toContain("900");
    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-player-1-lives"',
    );
    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-player-2-lives"',
    );
    expect(markup).toContain("Ada · Player 1");
    expect(markup).not.toContain(
      'data-testid="battle-city-multiplayer-readonly"',
    );
    expect(markup).toContain("max-width:min(100%, calc(100svh - 8rem))");
  });

  it("renders observers as read-only while preserving shared state", () => {
    const markup = renderToStaticMarkup(
      <BattleCityMultiplayerRoom
        activeParticipant={ACTIVE_BATTLE_CITY_ROOM.participants[2]!}
        game={RUNNING_BATTLE_CITY_GAME}
        onGameInput={vi.fn()}
        room={ACTIVE_BATTLE_CITY_ROOM}
      />,
    );

    expect(markup).toContain("Katherine · Observer");
    expect(markup).toContain('data-testid="battle-city-multiplayer-readonly"');
    expect(markup).toContain("Observer view");
    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-active-seat"',
    );
    expect(markup).toContain("Observer");
    expect(markup).toContain("1,200");
    expect(markup).toContain("900");
  });

  it("counts every retained life as a reserve while a player is inactive", () => {
    const markup = renderToStaticMarkup(
      <BattleCityMultiplayerRoom
        activeParticipant={ACTIVE_BATTLE_CITY_ROOM.participants[0]!}
        game={{
          ...RUNNING_BATTLE_CITY_GAME,
          snapshot: {
            ...RUNNING_BATTLE_CITY_GAME.snapshot,
            lives: 1,
            player: {
              ...RUNNING_BATTLE_CITY_GAME.snapshot.player,
              phase: "inactive",
            },
          },
        }}
        onGameInput={vi.fn()}
        room={ACTIVE_BATTLE_CITY_ROOM}
      />,
    );

    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-player-1-lives">1',
    );
    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-player-2-lives">2',
    );
  });

  it("renders supplied host lifecycle controls", () => {
    const markup = renderToStaticMarkup(
      <BattleCityMultiplayerRoom
        activeParticipant={ACTIVE_BATTLE_CITY_ROOM.participants[0]!}
        game={RUNNING_BATTLE_CITY_GAME}
        lifecycleControls={
          <div data-testid="multiplayer-room-host-controls">Host</div>
        }
        onGameInput={vi.fn()}
        room={ACTIVE_BATTLE_CITY_ROOM}
      />,
    );

    expect(markup).toContain('data-testid="multiplayer-room-host-controls"');
  });

  it("uses room pause state for the board overlay and status", () => {
    const markup = renderToStaticMarkup(
      <BattleCityMultiplayerRoom
        activeParticipant={ACTIVE_BATTLE_CITY_ROOM.participants[0]!}
        game={RUNNING_BATTLE_CITY_GAME}
        onGameInput={vi.fn()}
        room={{ ...ACTIVE_BATTLE_CITY_ROOM, status: "paused" }}
      />,
    );

    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-paused"',
    );
    expect(markup).toContain("text-[var(--battle-city-board-text)]");
    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-status">Paused',
    );
    expect(markup).toContain(
      'aria-live="polite" aria-atomic="true" class="sr-only" role="status" data-testid="battle-city-multiplayer-status-announcement">Paused',
    );
  });

  it("projects at most advanced visual frames and preserves authoritative stats", () => {
    const projectionSnapshot = {
      activePlayerSeat: "player-1",
      game: RUNNING_BATTLE_CITY_GAME,
      localDirection: "up",
      roomStatus: "running",
    } as const;
    const projected = projectBattleCityMultiplayerBoardGame(
      RUNNING_BATTLE_CITY_GAME,
      "player-1",
      "up",
      BATTLE_CITY_TICK_MS,
    );

    expect(
      isBattleCityMultiplayerProjectionFrameAdvanced(projectionSnapshot, 0),
    ).toBe(false);
    expect(
      isBattleCityMultiplayerProjectionFrameAdvanced(
        projectionSnapshot,
        BATTLE_CITY_TICK_MS,
      ),
    ).toBe(true);
    expect(projected.player.row).toBeLessThan(
      RUNNING_BATTLE_CITY_GAME.snapshot.player.row,
    );
    expect(projected.player2.row).toBe(
      RUNNING_BATTLE_CITY_GAME.snapshot.player2.row,
    );
    expect(projected.score).toBe(RUNNING_BATTLE_CITY_GAME.snapshot.score);
    expect(projected.player2Score).toBe(
      RUNNING_BATTLE_CITY_GAME.snapshot.player2Score,
    );
    expect(projected.lives).toBe(RUNNING_BATTLE_CITY_GAME.snapshot.lives);
    expect(projected.player2Lives).toBe(
      RUNNING_BATTLE_CITY_GAME.snapshot.player2Lives,
    );
  });

  it("uses local direction only for the active seat and server input for its teammate", () => {
    const game = {
      ...RUNNING_BATTLE_CITY_GAME,
      heldInputs: {
        "player-1": { direction: "down" },
        "player-2": { direction: "left" },
      },
    } satisfies BattleCityMultiplayerGameSnapshot;
    const heldInputs = getBattleCityMultiplayerProjectionHeldInputs(
      game,
      "player-1",
      "up",
    );
    const projected = projectBattleCityMultiplayerBoardGame(
      game,
      "player-1",
      "up",
      BATTLE_CITY_TICK_MS,
    );

    expect(heldInputs).toEqual({
      "player-1": { direction: "up" },
      "player-2": { direction: "left" },
    });
    expect(projected.player.row).toBeLessThan(game.snapshot.player.row);
    expect(projected.player2.col).toBeLessThan(game.snapshot.player2.col);
  });

  it("uses the active seat's server direction until local input is initialized", () => {
    const heldInputs = {
      "player-1": { direction: "down" },
      "player-2": { direction: "left" },
    } satisfies BattleCityMultiplayerHeldInputs;
    const game = {
      ...RUNNING_BATTLE_CITY_GAME,
      heldInputs,
    } satisfies BattleCityMultiplayerGameSnapshot;

    expect(
      getBattleCityMultiplayerProjectionHeldInputs(
        game,
        "player-1",
        undefined,
      ),
    ).toBe(heldInputs);
  });

  it("uses server held inputs without local overrides for observers", () => {
    const heldInputs = {
      "player-1": { direction: "up" },
      "player-2": { direction: "left" },
    } satisfies BattleCityMultiplayerHeldInputs;
    const game = {
      ...RUNNING_BATTLE_CITY_GAME,
      heldInputs,
    } satisfies BattleCityMultiplayerGameSnapshot;

    expect(
      getBattleCityMultiplayerProjectionHeldInputs(game, null, "down"),
    ).toBe(heldInputs);
  });

  it("renders separate stage-result tallies for both players", () => {
    const markup = renderToStaticMarkup(
      <BattleCityMultiplayerRoom
        activeParticipant={ACTIVE_BATTLE_CITY_ROOM.participants[0]!}
        game={{
          ...RUNNING_BATTLE_CITY_GAME,
          snapshot: {
            ...RUNNING_BATTLE_CITY_GAME.snapshot,
            player2StageKillCounts: {
              armor: 1,
              basic: 2,
              fast: 1,
              power: 0,
            },
            stageKillCounts: {
              armor: 0,
              basic: 3,
              fast: 2,
              power: 1,
            },
            stageResultTicks: 1_000,
            status: "stage-results",
          },
        }}
        onGameInput={vi.fn()}
        room={ACTIVE_BATTLE_CITY_ROOM}
      />,
    );

    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-stage-results"',
    );
    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-results-player-1"',
    );
    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-results-player-2"',
    );
    expect(markup).toContain("Player 1");
    expect(markup).toContain("Player 2");
    expect(markup.match(/role="status"/g)).toHaveLength(1);
  });

  it("renders the authoritative terminal summary", () => {
    const markup = renderToStaticMarkup(
      <BattleCityMultiplayerRoom
        activeParticipant={ACTIVE_BATTLE_CITY_ROOM.participants[0]!}
        game={{
          ...RUNNING_BATTLE_CITY_GAME,
          summary: {
            key: "battle-city|mode=private-room|start-stage=1",
            mode: "private-room",
            outcome: {
              cycle: 1,
              player1Lives: 0,
              player1ReserveLives: 1,
              player1Score: 1_200,
              player2Lives: 0,
              player2ReserveLives: 0,
              player2Score: 900,
              stage: 1,
            },
            seats: [
              {
                id: "player-1",
                label: "Player 1",
                participant: ACTIVE_BATTLE_CITY_ROOM.participants[0]!,
              },
              {
                id: "player-2",
                label: "Player 2",
                participant: ACTIVE_BATTLE_CITY_ROOM.participants[1]!,
              },
            ],
            settings: ACTIVE_BATTLE_CITY_ROOM.settings,
            status: "lost",
          },
          snapshot: {
            ...RUNNING_BATTLE_CITY_GAME.snapshot,
            lives: 0,
            player2Lives: 0,
            status: "lost",
          },
        }}
        onGameInput={vi.fn()}
        room={ACTIVE_BATTLE_CITY_ROOM}
      />,
    );

    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-terminal-message"',
    );
    expect(markup).toContain("Patrol lost · P1 1,200 · P2 900");
    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-status-announcement">Patrol lost · P1 1,200 · P2 900',
    );
    expect(markup).toContain(
      'data-testid="battle-city-multiplayer-terminal-summary"',
    );
    expect(markup).toContain("1,200 pts · 1 reserves");
    expect(markup).toContain("Ada · Player 1 / Grace · Player 2");
    expect(markup).toContain(
      "battle-city|mode=private-room|start-stage=1",
    );
  });

  it("registers and renders through the multiplayer renderer registry", () => {
    const renderer = getMultiplayerRoomGameRenderer(
      ACTIVE_BATTLE_CITY_ROOM,
      RUNNING_BATTLE_CITY_GAME,
    );

    expect(renderer?.gameId).toBe("battle-city");

    if (renderer === null) {
      throw new Error("Expected Tank Patrol to have a room game renderer");
    }

    const markup = renderToStaticMarkup(
      <MultiplayerRoomGameRendererView
        activeParticipant={ACTIVE_BATTLE_CITY_ROOM.participants[0]!}
        game={RUNNING_BATTLE_CITY_GAME}
        lifecycleControls={null}
        renderer={renderer}
        room={ACTIVE_BATTLE_CITY_ROOM}
        sendGameInput={vi.fn()}
      />,
    );

    expect(markup).toContain('data-testid="battle-city-multiplayer-room"');
    expect(markup).toContain('data-testid="battle-city-board"');
  });

  it("sends seated movement and one-shot fire payloads", () => {
    const inputState = createBattleCityMultiplayerInputState();
    const submitGameInput = vi.fn();
    const keyDownLeft = createTestKeyboardEvent("a");
    const keyDownFire = createTestKeyboardEvent("Enter");
    const keyDownRepeatedFire = createTestKeyboardEvent("Enter", {
      repeat: true,
    });
    const keyUpLeft = createTestKeyboardEvent("a");

    expect(
      handleBattleCityMultiplayerKeyDown({
        canSendGameInput: true,
        event: keyDownLeft,
        gameStatus: "running",
        inputState,
        submitGameInput,
      }),
    ).toBe(true);
    expect(submitGameInput).toHaveBeenLastCalledWith({
      direction: "left",
      type: "battle-city.setDirection",
    });

    expect(
      handleBattleCityMultiplayerKeyDown({
        canSendGameInput: true,
        event: keyDownFire,
        gameStatus: "running",
        inputState,
        submitGameInput,
      }),
    ).toBe(true);
    expect(submitGameInput).toHaveBeenLastCalledWith({
      type: "battle-city.fire",
    });

    handleBattleCityMultiplayerKeyDown({
      canSendGameInput: true,
      event: keyDownRepeatedFire,
      gameStatus: "running",
      inputState,
      submitGameInput,
    });
    expect(submitGameInput).toHaveBeenCalledTimes(2);

    expect(
      handleBattleCityMultiplayerKeyUp({
        canSendGameInput: true,
        event: keyUpLeft,
        inputState,
        submitGameInput,
      }),
    ).toBe(true);
    expect(submitGameInput).toHaveBeenLastCalledWith({
      direction: null,
      type: "battle-city.setDirection",
    });
    expect(submitGameInput).toHaveBeenCalledTimes(3);
    expect(keyDownLeft.preventDefault).toHaveBeenCalled();
    expect(keyDownFire.preventDefault).toHaveBeenCalled();
    expect(keyUpLeft.preventDefault).toHaveBeenCalled();
  });

  it("does not send observer keyboard input", () => {
    const inputState = createBattleCityMultiplayerInputState();
    const submitGameInput = vi.fn();
    const keyDown = createTestKeyboardEvent("ArrowRight");
    const keyUp = createTestKeyboardEvent("ArrowRight");

    expect(
      handleBattleCityMultiplayerKeyDown({
        canSendGameInput: false,
        event: keyDown,
        gameStatus: "running",
        inputState,
        submitGameInput,
      }),
    ).toBe(false);
    expect(
      handleBattleCityMultiplayerKeyUp({
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
