"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { useClientProjectionClock } from "@/components/client-projection-clock";
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
import { MultiplayerTerminalSummaryPanel } from "@/components/multiplayer-terminal-summary-panel";
import { PongBoard } from "@/components/pong-board";
import {
  createPongPaddleMovementState,
  getPongPaddleMovementKey,
  pressPongPaddleMovementKey,
  releasePongPaddleMovementKey,
  resetPongPaddleMovementState,
  type PongPaddleMovementDirection,
  type PongPaddleMovementState,
} from "@/components/pong-paddle-input";
import type {
  PrivateRoom,
  PrivateRoomParticipant,
} from "@/lib/multiplayer/room";
import type { PongGameState, PongSide, PongStatus } from "@/lib/pong-game-engine";
import {
  getPongMultiplayerProjectionTicks,
  projectPongMultiplayerGame,
  type PongMultiplayerClientInput,
  type PongMultiplayerGameSnapshot,
  type PongMultiplayerTerminalSummary,
} from "@/lib/pong-multiplayer";

type PongMultiplayerRoomProps = {
  activeParticipant: PrivateRoomParticipant | null;
  game: PongMultiplayerGameSnapshot;
  lifecycleControls?: ReactNode;
  onGameInput: (input: PongMultiplayerClientInput) => void | Promise<void>;
  onProjectionReconcile?: () => void;
  room: PrivateRoom;
};

export type PongMultiplayerInputTransition = {
  direction: PongPaddleMovementDirection | null;
  handled: boolean;
  shouldSend: boolean;
};

const statusLabels = {
  lost: "Right paddle won",
  paused: "Paused",
  ready: "Ready to serve",
  running: "Running",
  won: "Left paddle won",
} satisfies Record<PongStatus, string>;

const terminalSummaries = {
  lost: "Right paddle wins the match",
  won: "Left paddle wins the match",
} satisfies Partial<Record<PongStatus, string>>;

function isPongMultiplayerProjectionEnabled(game: PongMultiplayerGameSnapshot) {
  return game.snapshot.status === "running";
}

function getPongMultiplayerProjectionFrameKey(
  _game: PongMultiplayerGameSnapshot,
  elapsedMs: number,
) {
  return getPongMultiplayerProjectionTicks(elapsedMs);
}

export function isPongMultiplayerProjectionFrameAdvanced(
  _game: PongMultiplayerGameSnapshot,
  elapsedMs: number,
) {
  return getPongMultiplayerProjectionTicks(elapsedMs) > 0;
}

function projectPongMultiplayerSnapshot(
  game: PongMultiplayerGameSnapshot,
  elapsedMs: number,
) {
  return projectPongMultiplayerGame(game.snapshot, game.heldInputs, elapsedMs);
}

function useProjectedPongMultiplayerGame(
  game: PongMultiplayerGameSnapshot,
  onProjectionReconcile: (() => void) | undefined,
) {
  return useClientProjectionClock({
    baseValue: game.snapshot,
    getProjectionFrameKey: getPongMultiplayerProjectionFrameKey,
    isProjectionFrameAdvanced: isPongMultiplayerProjectionFrameAdvanced,
    isProjectionEnabled: isPongMultiplayerProjectionEnabled,
    onReconcile: onProjectionReconcile,
    project: projectPongMultiplayerSnapshot,
    seq: game.seq,
    serverTimeMs: game.serverTimeMs,
    snapshot: game,
    status: game.snapshot.status,
  });
}

function PongMultiplayerProjectedBoard({
  children,
  game,
  onProjectionReconcile,
  statusLabel,
}: {
  children?: ReactNode;
  game: PongMultiplayerGameSnapshot;
  onProjectionReconcile?: () => void;
  statusLabel: string;
}) {
  const projectedGame = useProjectedPongMultiplayerGame(
    game,
    onProjectionReconcile,
  );

  return (
    <PongBoard game={projectedGame} statusLabel={statusLabel}>
      {children}
    </PongBoard>
  );
}

export function createPongMultiplayerInputState() {
  return createPongPaddleMovementState();
}

export function pressPongMultiplayerInputKey(
  state: PongPaddleMovementState,
  key: string,
): PongMultiplayerInputTransition {
  const movementKey = getPongPaddleMovementKey(key);

  if (movementKey === null) {
    return {
      direction: state.direction,
      handled: false,
      shouldSend: false,
    };
  }

  const previousDirection = state.direction;
  const movement = pressPongPaddleMovementKey(state, movementKey);

  return {
    direction: movement.direction,
    handled: true,
    shouldSend:
      movement.shouldMoveImmediately && movement.direction !== previousDirection,
  };
}

export function releasePongMultiplayerInputKey(
  state: PongPaddleMovementState,
  key: string,
): PongMultiplayerInputTransition {
  const movementKey = getPongPaddleMovementKey(key);

  if (movementKey === null) {
    return {
      direction: state.direction,
      handled: false,
      shouldSend: false,
    };
  }

  const previousDirection = state.direction;
  const movement = releasePongPaddleMovementKey(state, movementKey);

  return {
    direction: movement.direction,
    handled: movement.handled,
    shouldSend: movement.handled && movement.direction !== previousDirection,
  };
}

export function resetPongMultiplayerInputState(
  state: PongPaddleMovementState,
): PongMultiplayerInputTransition {
  const previousDirection = state.direction;

  resetPongPaddleMovementState(state);

  return {
    direction: null,
    handled: previousDirection !== null,
    shouldSend: previousDirection !== null,
  };
}

function isPongMultiplayerServeKey(key: string) {
  return key === " " || key === "Enter";
}

export function getPongMultiplayerStatusLabel(status: PongStatus) {
  return statusLabels[status];
}

export function getPongMultiplayerBoardFrameMaxWidth(game: PongMultiplayerGameSnapshot) {
  const boardAspectRatio = game.snapshot.boardWidth / game.snapshot.boardHeight;

  return `min(100%, calc((100svh - 8rem) * ${boardAspectRatio}))`;
}

export function PongMultiplayerRoom({
  activeParticipant,
  game,
  lifecycleControls = null,
  onGameInput,
  onProjectionReconcile,
  room,
}: PongMultiplayerRoomProps) {
  const onGameInputRef = useRef(onGameInput);
  const inputStateRef = useRef(createPongMultiplayerInputState());
  const gameState = game.snapshot;
  const activeSeat = useMemo(
    () =>
      getMultiplayerActiveRoomParticipantSeat(
        room.seats,
        activeParticipant?.id ?? null,
      ),
    [activeParticipant?.id, room.seats],
  );
  const canSendGameInput = activeSeat !== null;
  const canServeGameInput = canSendGameInput && activeSeat.id === gameState.serveSide;
  const statusLabel = getPongMultiplayerStatusLabel(gameState.status);
  const boardFrameMaxWidth = getPongMultiplayerBoardFrameMaxWidth(game);
  const sidePanels = [
    {
      content: (
        <PongMultiplayerStatsPanel
          gameState={gameState}
          statusLabel={statusLabel}
          summary={game.summary}
        />
      ),
      id: "pong-stats",
    },
  ] satisfies MultiplayerActiveRoomSidePanel[];

  useEffect(() => {
    onGameInputRef.current = onGameInput;
  }, [onGameInput]);

  const submitGameInput = useCallback((input: PongMultiplayerClientInput) => {
    void onGameInputRef.current(input);
  }, []);

  const clearPaddleDirection = useCallback(() => {
    const transition = resetPongMultiplayerInputState(inputStateRef.current);

    if (transition.shouldSend) {
      submitGameInput({
        direction: null,
        type: "pong.setPaddleDirection",
      });
    }
  }, [submitGameInput]);

  useEffect(() => {
    if (!canSendGameInput) {
      clearPaddleDirection();
    }
  }, [canSendGameInput, clearPaddleDirection]);

  useEffect(() => {
    function handleWindowBlur() {
      clearPaddleDirection();
    }

    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      clearPaddleDirection();
    };
  }, [clearPaddleDirection]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!canSendGameInput || shouldIgnoreGameKeyDown(event)) {
        return;
      }

      if (isPongMultiplayerServeKey(event.key) && gameState.status === "ready") {
        event.preventDefault();

        if (!event.repeat && canServeGameInput) {
          submitGameInput({ type: "pong.serve" });
        }

        return;
      }

      const transition = pressPongMultiplayerInputKey(
        inputStateRef.current,
        event.key,
      );

      if (!transition.handled) {
        return;
      }

      event.preventDefault();

      if (transition.shouldSend) {
        submitGameInput({
          direction: transition.direction,
          type: "pong.setPaddleDirection",
        });
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (!canSendGameInput) {
        return;
      }

      const transition = releasePongMultiplayerInputKey(
        inputStateRef.current,
        event.key,
      );

      if (!transition.handled) {
        return;
      }

      event.preventDefault();

      if (transition.shouldSend) {
        submitGameInput({
          direction: transition.direction,
          type: "pong.setPaddleDirection",
        });
      }
    }

    const unregisterKeyDown = registerGameKeyDown(handleKeyDown);
    const unregisterKeyUp = registerGameKeyUp(handleKeyUp);

    return () => {
      unregisterKeyDown();
      unregisterKeyUp();
    };
  }, [canSendGameInput, canServeGameInput, gameState.status, submitGameInput]);

  return (
    <MultiplayerActiveRoomShell
      activeParticipant={activeParticipant}
      activeSeat={activeSeat}
      board={
        <PongMultiplayerProjectedBoard
          game={game}
          onProjectionReconcile={onProjectionReconcile}
          statusLabel={statusLabel}
        >
          {gameState.status === "ready" ? (
            <div
              className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--pong-board)_62%,transparent)] px-4 py-5 text-center text-[var(--pong-ball)] backdrop-blur-[1px]"
              data-testid="pong-multiplayer-ready-message"
            >
              <div className="flex max-w-72 flex-col items-center gap-3 rounded-md border border-[color-mix(in_oklch,var(--pong-ball)_20%,transparent)] bg-[color-mix(in_oklch,var(--pong-board)_88%,white_12%)] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.28)] dark:bg-[color-mix(in_oklch,var(--pong-board)_88%,black_12%)]">
                <p className="text-2xl font-semibold tracking-normal">
                  Ready to serve
                </p>
                <p
                  className="rounded-md border border-[color-mix(in_oklch,var(--pong-ball)_20%,transparent)] bg-[color-mix(in_oklch,var(--pong-board)_78%,white_18%)] px-4 py-3 text-sm font-semibold text-[var(--pong-ball)] dark:bg-[color-mix(in_oklch,var(--pong-board)_84%,black_10%)]"
                  data-testid="pong-multiplayer-serve-key-hint"
                >
                  {canServeGameInput
                    ? "Press Space or Enter to serve"
                    : `${formatPongServeSide(gameState.serveSide)} paddle serves`}
                </p>
              </div>
            </div>
          ) : null}

          {gameState.status === "paused" ? (
            <div
              className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--pong-board)_76%,transparent)] text-center text-[var(--pong-ball)] backdrop-blur-[2px]"
              data-testid="pong-multiplayer-paused-message"
            >
              <p className="text-2xl font-semibold tracking-normal">Paused</p>
            </div>
          ) : null}

          {gameState.status === "won" || gameState.status === "lost" ? (
            <div
              className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--pong-board)_76%,transparent)] px-4 text-center text-[var(--pong-ball)] backdrop-blur-[2px]"
              data-testid="pong-multiplayer-terminal-message"
            >
              <p className="text-2xl font-semibold tracking-normal">
                {getPongMultiplayerTerminalMessage(
                  game.summary,
                  gameState.status,
                )}
              </p>
            </div>
          ) : null}
        </PongMultiplayerProjectedBoard>
      }
      boardFrameMaxWidth={boardFrameMaxWidth}
      boardFrameTestId="pong-multiplayer-board-frame"
      lifecycleControls={lifecycleControls}
      readOnlyTestId="pong-multiplayer-readonly"
      roleLabelTestId="pong-multiplayer-role"
      rootTestId="pong-multiplayer-room"
      sidePanels={sidePanels}
    />
  );
}

function formatPongServeSide(serveSide: PongSide) {
  return serveSide === "left" ? "Left" : "Right";
}

function getPongMultiplayerTerminalMessage(
  summary: PongMultiplayerTerminalSummary | undefined,
  status: Extract<PongStatus, "lost" | "won">,
) {
  if (summary === undefined) {
    return terminalSummaries[status];
  }

  return `${getPongSummaryWinnerName(summary)} wins ${summary.outcome.leftScore}-${summary.outcome.rightScore}`;
}

function getPongSummaryWinnerName(summary: PongMultiplayerTerminalSummary) {
  const winnerSeat = getPongSummarySeat(summary, summary.outcome.winnerSeatId);

  return winnerSeat?.participant?.displayName ?? getPongSummarySeatName(summary);
}

function getPongSummarySeatName(summary: PongMultiplayerTerminalSummary) {
  return summary.outcome.winnerSeatId === "left" ? "Left paddle" : "Right paddle";
}

function getPongSummarySeat(
  summary: PongMultiplayerTerminalSummary,
  seatId: PongSide,
) {
  return summary.seats.find((seat) => seat.id === seatId) ?? null;
}

function getPongSummaryWinnerLabel(summary: PongMultiplayerTerminalSummary) {
  const winnerSeat = getPongSummarySeat(summary, summary.outcome.winnerSeatId);
  const seatLabel = winnerSeat?.label ?? getPongSummarySeatName(summary);

  if (winnerSeat?.participant === undefined || winnerSeat.participant === null) {
    return seatLabel;
  }

  return `${winnerSeat.participant.displayName} · ${seatLabel}`;
}

function PongMultiplayerStatsPanel({
  gameState,
  statusLabel,
  summary,
}: {
  gameState: PongGameState;
  statusLabel: string;
  summary?: PongMultiplayerTerminalSummary;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-normal">Pong</h2>
        <span
          className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-accent-faint)] px-2 py-1 text-xs font-semibold uppercase tracking-normal text-[var(--chrome-ink)]"
          data-testid="pong-multiplayer-status"
        >
          {statusLabel}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <PongRoomStat
          label="Left"
          testId="pong-multiplayer-score-left"
          value={gameState.score.player}
        />
        <PongRoomStat
          label="Right"
          testId="pong-multiplayer-score-right"
          value={gameState.score.cpu}
        />
        <PongRoomStat
          label="Target"
          testId="pong-multiplayer-target"
          value={gameState.targetScore}
        />
        <PongRoomStat
          label="Score"
          testId="pong-multiplayer-remaining-score"
          value={gameState.remainingScore}
        />
      </dl>

      {summary === undefined ? null : (
        <PongMultiplayerTerminalSummaryPanel summary={summary} />
      )}
    </>
  );
}

function PongMultiplayerTerminalSummaryPanel({
  summary,
}: {
  summary: PongMultiplayerTerminalSummary;
}) {
  return (
    <MultiplayerTerminalSummaryPanel
      rows={[
        {
          label: "Winner",
          testId: "pong-multiplayer-summary-winner",
          value: getPongSummaryWinnerLabel(summary),
        },
        {
          label: "Final",
          testId: "pong-multiplayer-summary-score",
          value: `${summary.outcome.leftScore}-${summary.outcome.rightScore}`,
        },
        {
          label: "Key",
          testId: "pong-multiplayer-summary-key",
          value: summary.key,
        },
      ]}
      testId="pong-multiplayer-terminal-summary"
    />
  );
}

function PongRoomStat({
  label,
  testId,
  value,
}: {
  label: string;
  testId: string;
  value: number;
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
