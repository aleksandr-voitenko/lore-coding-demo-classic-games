"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import {
  registerGameKeyDown,
  registerGameKeyUp,
  shouldIgnoreGameKeyDown,
} from "@/components/game-input";
import {
  MultiplayerActiveRoomShell,
  getMultiplayerActiveRoomParticipantSeat,
  type MultiplayerActiveRoomSidePanel,
} from "@/components/multiplayer-active-room-shell";
import {
  SpaceInvadersBoard,
  type SpaceInvadersBoardShip,
} from "@/components/space-invaders-board";
import { playerBShipSpriteSrc } from "@/components/space-invaders-board-assets";
import {
  createSpaceInvadersPlayerMovementState,
  getSpaceInvadersPlayerMovementKey,
  pressSpaceInvadersPlayerMovementKey,
  releaseSpaceInvadersPlayerMovementKey,
  resetSpaceInvadersPlayerMovementState,
  type SpaceInvadersPlayerMovementDirection,
  type SpaceInvadersPlayerMovementState,
} from "@/components/space-invaders-player-input";
import type {
  PrivateRoom,
  PrivateRoomParticipant,
} from "@/lib/multiplayer/room";
import type { SpaceInvadersStatus } from "@/lib/space-invaders-game-engine";
import {
  SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS,
  isSpaceInvadersShipSeat,
  type SpaceInvadersMultiplayerClientInput,
  type SpaceInvadersMultiplayerGameSnapshot,
  type SpaceInvadersMultiplayerGameState,
  type SpaceInvadersMultiplayerTerminalSummary,
} from "@/lib/space-invaders-multiplayer";

type SpaceInvadersMultiplayerRoomProps = {
  activeParticipant: PrivateRoomParticipant | null;
  game: SpaceInvadersMultiplayerGameSnapshot;
  lifecycleControls?: ReactNode;
  onGameInput: (
    input: SpaceInvadersMultiplayerClientInput,
  ) => void | Promise<void>;
  room: PrivateRoom;
};

type SpaceInvadersMultiplayerKeyboardEvent = Pick<
  KeyboardEvent,
  "key" | "preventDefault" | "repeat" | "target"
>;

export type SpaceInvadersMultiplayerInputTransition = {
  direction: SpaceInvadersPlayerMovementDirection | null;
  handled: boolean;
  shouldSend: boolean;
};

type SpaceInvadersMultiplayerKeyDownOptions = {
  canSendGameInput: boolean;
  event: SpaceInvadersMultiplayerKeyboardEvent;
  gameStatus: SpaceInvadersStatus;
  inputState: SpaceInvadersPlayerMovementState;
  submitGameInput: (input: SpaceInvadersMultiplayerClientInput) => void;
};

type SpaceInvadersMultiplayerKeyUpOptions = {
  canSendGameInput: boolean;
  event: Pick<KeyboardEvent, "key" | "preventDefault">;
  inputState: SpaceInvadersPlayerMovementState;
  submitGameInput: (input: SpaceInvadersMultiplayerClientInput) => void;
};

const statusLabels = {
  lost: "Lost",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
  won: "Won",
} satisfies Record<SpaceInvadersStatus, string>;

function isSpaceInvadersMultiplayerFireKey(key: string) {
  return key === " " || key === "Enter";
}

export function createSpaceInvadersMultiplayerInputState() {
  return createSpaceInvadersPlayerMovementState();
}

export function pressSpaceInvadersMultiplayerInputKey(
  state: SpaceInvadersPlayerMovementState,
  key: string,
): SpaceInvadersMultiplayerInputTransition {
  const movementKey = getSpaceInvadersPlayerMovementKey(key);

  if (movementKey === null) {
    return {
      direction: state.direction,
      handled: false,
      shouldSend: false,
    };
  }

  const previousDirection = state.direction;
  const movement = pressSpaceInvadersPlayerMovementKey(state, movementKey);

  return {
    direction: movement.direction,
    handled: true,
    shouldSend:
      movement.shouldMoveImmediately && movement.direction !== previousDirection,
  };
}

export function releaseSpaceInvadersMultiplayerInputKey(
  state: SpaceInvadersPlayerMovementState,
  key: string,
): SpaceInvadersMultiplayerInputTransition {
  const movementKey = getSpaceInvadersPlayerMovementKey(key);

  if (movementKey === null) {
    return {
      direction: state.direction,
      handled: false,
      shouldSend: false,
    };
  }

  const previousDirection = state.direction;
  const movement = releaseSpaceInvadersPlayerMovementKey(state, movementKey);

  return {
    direction: movement.direction,
    handled: movement.handled,
    shouldSend: movement.handled && movement.direction !== previousDirection,
  };
}

export function resetSpaceInvadersMultiplayerInputState(
  state: SpaceInvadersPlayerMovementState,
): SpaceInvadersMultiplayerInputTransition {
  const previousDirection = state.direction;

  resetSpaceInvadersPlayerMovementState(state);

  return {
    direction: null,
    handled: previousDirection !== null,
    shouldSend: previousDirection !== null,
  };
}

export function handleSpaceInvadersMultiplayerKeyDown({
  canSendGameInput,
  event,
  gameStatus,
  inputState,
  submitGameInput,
}: SpaceInvadersMultiplayerKeyDownOptions) {
  if (!canSendGameInput || shouldIgnoreGameKeyDown(event)) {
    return false;
  }

  if (isSpaceInvadersMultiplayerFireKey(event.key)) {
    event.preventDefault();

    if (!event.repeat && gameStatus === "running") {
      submitGameInput({ type: "space-invaders.fire" });
    }

    return true;
  }

  const transition = pressSpaceInvadersMultiplayerInputKey(
    inputState,
    event.key,
  );

  if (!transition.handled) {
    return false;
  }

  event.preventDefault();

  if (transition.shouldSend) {
    submitGameInput({
      direction: transition.direction,
      type: "space-invaders.setShipDirection",
    });
  }

  return true;
}

export function handleSpaceInvadersMultiplayerKeyUp({
  canSendGameInput,
  event,
  inputState,
  submitGameInput,
}: SpaceInvadersMultiplayerKeyUpOptions) {
  if (!canSendGameInput) {
    return false;
  }

  const transition = releaseSpaceInvadersMultiplayerInputKey(
    inputState,
    event.key,
  );

  if (!transition.handled) {
    return false;
  }

  event.preventDefault();

  if (transition.shouldSend) {
    submitGameInput({
      direction: transition.direction,
      type: "space-invaders.setShipDirection",
    });
  }

  return true;
}

export function getSpaceInvadersMultiplayerStatusLabel(
  status: SpaceInvadersStatus,
) {
  return statusLabels[status];
}

export function getSpaceInvadersMultiplayerBoardFrameMaxWidth(
  game: SpaceInvadersMultiplayerGameSnapshot,
) {
  const boardAspectRatio = game.snapshot.boardWidth / game.snapshot.boardHeight;

  return `min(100%, calc((100svh - 8rem) * ${boardAspectRatio}))`;
}

export function SpaceInvadersMultiplayerRoom({
  activeParticipant,
  game,
  lifecycleControls = null,
  onGameInput,
  room,
}: SpaceInvadersMultiplayerRoomProps) {
  const onGameInputRef = useRef(onGameInput);
  const inputStateRef = useRef(createSpaceInvadersMultiplayerInputState());
  const gameState = game.snapshot;
  const activeSeat = useMemo(
    () =>
      getMultiplayerActiveRoomParticipantSeat(
        room.seats,
        activeParticipant?.id ?? null,
      ),
    [activeParticipant?.id, room.seats],
  );
  const activeShipSeat =
    activeSeat !== null && isSpaceInvadersShipSeat(activeSeat.id)
      ? activeSeat.id
      : null;
  const activeRoomSeat = activeShipSeat === null ? null : activeSeat;
  const canSendGameInput = activeShipSeat !== null && gameState.status === "running";
  const statusLabel = getSpaceInvadersMultiplayerStatusLabel(gameState.status);
  const boardFrameMaxWidth = getSpaceInvadersMultiplayerBoardFrameMaxWidth(game);
  const sidePanels = [
    {
      content: (
        <SpaceInvadersMultiplayerStatsPanel
          activeSeatLabel={activeRoomSeat?.label ?? "Observer"}
          gameState={gameState}
          statusLabel={statusLabel}
          summary={game.summary}
        />
      ),
      id: "space-invaders-stats",
    },
  ] satisfies MultiplayerActiveRoomSidePanel[];

  useEffect(() => {
    onGameInputRef.current = onGameInput;
  }, [onGameInput]);

  const submitGameInput = useCallback(
    (input: SpaceInvadersMultiplayerClientInput) => {
      void onGameInputRef.current(input);
    },
    [],
  );

  const clearShipDirection = useCallback(() => {
    const transition = resetSpaceInvadersMultiplayerInputState(
      inputStateRef.current,
    );

    if (transition.shouldSend) {
      submitGameInput({
        direction: null,
        type: "space-invaders.setShipDirection",
      });
    }
  }, [submitGameInput]);

  useEffect(() => {
    if (!canSendGameInput) {
      clearShipDirection();
    }
  }, [canSendGameInput, clearShipDirection]);

  useEffect(() => {
    function handleWindowBlur() {
      clearShipDirection();
    }

    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      clearShipDirection();
    };
  }, [clearShipDirection]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      handleSpaceInvadersMultiplayerKeyDown({
        canSendGameInput,
        event,
        gameStatus: gameState.status,
        inputState: inputStateRef.current,
        submitGameInput,
      });
    }

    function handleKeyUp(event: KeyboardEvent) {
      handleSpaceInvadersMultiplayerKeyUp({
        canSendGameInput,
        event,
        inputState: inputStateRef.current,
        submitGameInput,
      });
    }

    const unregisterKeyDown = registerGameKeyDown(handleKeyDown);
    const unregisterKeyUp = registerGameKeyUp(handleKeyUp);

    return () => {
      unregisterKeyDown();
      unregisterKeyUp();
    };
  }, [canSendGameInput, gameState.status, submitGameInput]);

  return (
    <MultiplayerActiveRoomShell
      activeParticipant={activeParticipant}
      activeSeat={activeRoomSeat}
      board={
        <SpaceInvadersBoard
          fillViewport={false}
          game={gameState}
          ships={getSpaceInvadersMultiplayerBoardShips(gameState)}
          statusLabel={statusLabel}
        >
          {gameState.status === "paused" ? (
            <div
              className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--invaders-board)_76%,transparent)] text-center text-[var(--invaders-player)] backdrop-blur-[2px]"
              data-testid="space-invaders-multiplayer-paused-message"
            >
              <p className="text-2xl font-semibold tracking-normal">Paused</p>
            </div>
          ) : null}

          {gameState.status === "won" || gameState.status === "lost" ? (
            <div
              className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--invaders-board)_76%,transparent)] px-4 text-center text-[var(--invaders-player)] backdrop-blur-[2px]"
              data-testid="space-invaders-multiplayer-terminal-message"
            >
              <p className="text-2xl font-semibold tracking-normal">
                {getSpaceInvadersMultiplayerTerminalMessage(
                  game.summary,
                  statusLabel,
                )}
              </p>
            </div>
          ) : null}
        </SpaceInvadersBoard>
      }
      boardFrameMaxWidth={boardFrameMaxWidth}
      boardFrameTestId="space-invaders-multiplayer-board-frame"
      lifecycleControls={lifecycleControls}
      readOnlyTestId="space-invaders-multiplayer-readonly"
      roleLabelTestId="space-invaders-multiplayer-role"
      rootTestId="space-invaders-multiplayer-room"
      sidePanels={sidePanels}
    />
  );
}

function getSpaceInvadersMultiplayerBoardShips(
  gameState: SpaceInvadersMultiplayerGameState,
): SpaceInvadersBoardShip[] {
  return SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS.map((seat) => {
    const ship = gameState.ships[seat];

    return {
      id: seat,
      isActive: ship.isActive,
      player: ship.player,
      playerRespawnTicks: ship.playerRespawnTicks,
      playerShieldTicks: ship.playerShieldTicks,
      playerShots: ship.playerShots,
      spriteSrc: seat === "ship-b" ? playerBShipSpriteSrc : undefined,
    };
  });
}

function SpaceInvadersMultiplayerStatsPanel({
  activeSeatLabel,
  gameState,
  statusLabel,
  summary,
}: {
  activeSeatLabel: string;
  gameState: SpaceInvadersMultiplayerGameState;
  statusLabel: string;
  summary?: SpaceInvadersMultiplayerTerminalSummary;
}) {
  const remainingInvaders = gameState.invaders.filter(
    (invader) => invader.isActive,
  ).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-normal">Space Invaders</h2>
        <span
          className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-accent-faint)] px-2 py-1 text-xs font-semibold uppercase tracking-normal text-[var(--chrome-ink)]"
          data-testid="space-invaders-multiplayer-status"
        >
          {statusLabel}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <SpaceInvadersRoomStat
          label="Score"
          testId="space-invaders-multiplayer-score"
          value={gameState.score}
        />
        <SpaceInvadersRoomStat
          label="Lives"
          testId="space-invaders-multiplayer-lives"
          value={gameState.lives}
        />
        <SpaceInvadersRoomStat
          label="Invaders"
          testId="space-invaders-multiplayer-invaders"
          value={remainingInvaders}
        />
        <SpaceInvadersRoomStat
          label="Active"
          testId="space-invaders-multiplayer-active-seat"
          value={activeSeatLabel}
        />
      </dl>

      {summary === undefined ? null : (
        <SpaceInvadersMultiplayerTerminalSummaryPanel summary={summary} />
      )}
    </>
  );
}

function getSpaceInvadersMultiplayerTerminalMessage(
  summary: SpaceInvadersMultiplayerTerminalSummary | undefined,
  statusLabel: string,
) {
  if (summary === undefined) {
    return statusLabel;
  }

  return summary.status === "won"
    ? `Mission won · ${summary.outcome.score} points`
    : `Mission lost · ${summary.outcome.livesRemaining} lives`;
}

function SpaceInvadersMultiplayerTerminalSummaryPanel({
  summary,
}: {
  summary: SpaceInvadersMultiplayerTerminalSummary;
}) {
  return (
    <section
      className="mt-4 rounded-md border border-[var(--chrome-border)] p-3"
      data-testid="space-invaders-multiplayer-terminal-summary"
    >
      <h3 className="text-sm font-semibold tracking-normal">Match summary</h3>
      <dl className="mt-3 grid gap-2 text-sm">
        <SpaceInvadersSummaryRow
          label="Outcome"
          testId="space-invaders-multiplayer-summary-outcome"
          value={summary.status === "won" ? "Won" : "Lost"}
        />
        <SpaceInvadersSummaryRow
          label="Crew"
          testId="space-invaders-multiplayer-summary-crew"
          value={getSpaceInvadersSummaryCrewLabel(summary)}
        />
        <SpaceInvadersSummaryRow
          label="Score"
          testId="space-invaders-multiplayer-summary-score"
          value={String(summary.outcome.score)}
        />
        <SpaceInvadersSummaryRow
          label="Lives"
          testId="space-invaders-multiplayer-summary-lives"
          value={String(summary.outcome.livesRemaining)}
        />
        <SpaceInvadersSummaryRow
          label="Key"
          testId="space-invaders-multiplayer-summary-key"
          value={summary.key}
        />
      </dl>
    </section>
  );
}

function getSpaceInvadersSummaryCrewLabel(
  summary: SpaceInvadersMultiplayerTerminalSummary,
) {
  return summary.seats
    .map((seat) => {
      const playerLabel = seat.participant?.displayName ?? "Open";

      return `${playerLabel} · ${seat.label}`;
    })
    .join(" / ");
}

function SpaceInvadersSummaryRow({
  label,
  testId,
  value,
}: {
  label: string;
  testId: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--chrome-muted)]">
        {label}
      </dt>
      <dd className="mt-1 break-all font-semibold tracking-normal" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function SpaceInvadersRoomStat({
  label,
  testId,
  value,
}: {
  label: string;
  testId: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md border border-[var(--chrome-border)] p-3">
      <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--chrome-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tracking-normal" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
