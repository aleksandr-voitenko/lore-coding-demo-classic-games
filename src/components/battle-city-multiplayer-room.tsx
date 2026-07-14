"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { BattleCityBoard } from "@/components/battle-city-board";
import {
  createBattleCityPlayerMovementState,
  getBattleCityPlayerMovementKey,
  pressBattleCityPlayerMovementKey,
  releaseBattleCityPlayerMovementKey,
  resetBattleCityPlayerMovementState,
  type BattleCityPlayerMovementState,
} from "@/components/battle-city-player-input";
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
import {
  formatBattleCityStageLabel,
  getBattleCityMultiplayerStageResultDisplay,
  getBattleCityReserveLives,
  type BattleCityDirection,
  type BattleCityKillCounts,
  type BattleCityMultiplayerGameState,
  type BattleCityStatus,
} from "@/lib/battle-city-game-engine";
import {
  getBattleCityMultiplayerProjectionTicks,
  isBattleCityMultiplayerPlayerSeat,
  projectBattleCityMultiplayerGame,
  type BattleCityMultiplayerClientInput,
  type BattleCityMultiplayerGameSnapshot,
  type BattleCityMultiplayerHeldInputs,
  type BattleCityMultiplayerPlayerSeat,
  type BattleCityMultiplayerTerminalSummary,
} from "@/lib/battle-city-multiplayer";
import type {
  PrivateRoom,
  PrivateRoomParticipant,
} from "@/lib/multiplayer/room";

type BattleCityMultiplayerRoomProps = {
  activeParticipant: PrivateRoomParticipant | null;
  game: BattleCityMultiplayerGameSnapshot;
  lifecycleControls?: ReactNode;
  onGameInput: (
    input: BattleCityMultiplayerClientInput,
  ) => void | Promise<void>;
  onProjectionReconcile?: () => void;
  room: PrivateRoom;
};

type BattleCityMultiplayerKeyboardEvent = Pick<
  KeyboardEvent,
  "key" | "preventDefault" | "repeat" | "target"
>;

type BattleCityMultiplayerKeyDownOptions = {
  canSendGameInput: boolean;
  event: BattleCityMultiplayerKeyboardEvent;
  gameStatus: BattleCityStatus;
  inputState: BattleCityPlayerMovementState;
  submitGameInput: (input: BattleCityMultiplayerClientInput) => void;
};

type BattleCityMultiplayerKeyUpOptions = {
  canSendGameInput: boolean;
  event: Pick<KeyboardEvent, "key" | "preventDefault">;
  inputState: BattleCityPlayerMovementState;
  submitGameInput: (input: BattleCityMultiplayerClientInput) => void;
};

export type BattleCityMultiplayerInputTransition = {
  direction: BattleCityDirection | null;
  handled: boolean;
  shouldSend: boolean;
};

export type BattleCityMultiplayerProjectionSnapshot = {
  activePlayerSeat: BattleCityMultiplayerPlayerSeat | null;
  game: BattleCityMultiplayerGameSnapshot;
  localDirection: BattleCityDirection | null | undefined;
  roomStatus: PrivateRoom["status"];
};

const statusLabels = {
  "game-over": "Game over",
  lost: "Game over",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
  "stage-clear": "Stage clear",
  "stage-intro": "Stage intro",
  "stage-results": "Stage results",
} satisfies Record<BattleCityStatus, string>;

const stageResultRows = [
  { label: "Basic", type: "basic" },
  { label: "Fast", type: "fast" },
  { label: "Power", type: "power" },
  { label: "Armor", type: "armor" },
] as const;

function isBattleCityMultiplayerFireKey(key: string) {
  return key === " " || key === "Enter";
}

function canControlBattleCityMultiplayerPlayer(status: BattleCityStatus) {
  return status === "running" || status === "stage-clear";
}

function isBattleCityMultiplayerProjectionEnabled({
  game,
  roomStatus,
}: BattleCityMultiplayerProjectionSnapshot) {
  return (
    roomStatus === "running" &&
    canControlBattleCityMultiplayerPlayer(game.snapshot.status)
  );
}

export function getBattleCityMultiplayerProjectionFrameKey(
  snapshot: BattleCityMultiplayerProjectionSnapshot,
  elapsedMs: number,
) {
  return [
    getBattleCityMultiplayerProjectionTicks(elapsedMs),
    snapshot.activePlayerSeat ?? "observer",
    snapshot.localDirection === undefined
      ? "server"
      : (snapshot.localDirection ?? "stationary"),
    snapshot.roomStatus,
  ].join(":");
}

export function isBattleCityMultiplayerProjectionFrameAdvanced(
  _snapshot: BattleCityMultiplayerProjectionSnapshot,
  elapsedMs: number,
) {
  return getBattleCityMultiplayerProjectionTicks(elapsedMs) > 0;
}

export function getBattleCityMultiplayerProjectionHeldInputs(
  game: BattleCityMultiplayerGameSnapshot,
  activePlayerSeat: BattleCityMultiplayerPlayerSeat | null,
  localDirection: BattleCityDirection | null | undefined,
): BattleCityMultiplayerHeldInputs {
  if (activePlayerSeat === null || localDirection === undefined) {
    return game.heldInputs;
  }

  return {
    ...game.heldInputs,
    [activePlayerSeat]: {
      ...game.heldInputs[activePlayerSeat],
      direction: localDirection,
    },
  };
}

export function projectBattleCityMultiplayerBoardGame(
  game: BattleCityMultiplayerGameSnapshot,
  activePlayerSeat: BattleCityMultiplayerPlayerSeat | null,
  localDirection: BattleCityDirection | null | undefined,
  elapsedMs: number,
) {
  return projectBattleCityMultiplayerGame(
    game.snapshot,
    getBattleCityMultiplayerProjectionHeldInputs(
      game,
      activePlayerSeat,
      localDirection,
    ),
    elapsedMs,
  );
}

function projectBattleCityMultiplayerProjectionSnapshot(
  snapshot: BattleCityMultiplayerProjectionSnapshot,
  elapsedMs: number,
) {
  return projectBattleCityMultiplayerBoardGame(
    snapshot.game,
    snapshot.activePlayerSeat,
    snapshot.localDirection,
    elapsedMs,
  );
}

function getBattleCityMultiplayerProjectionIdentity(
  game: BattleCityMultiplayerGameSnapshot,
  activePlayerSeat: BattleCityMultiplayerPlayerSeat | null,
  localDirection: BattleCityDirection | null | undefined,
  roomStatus: PrivateRoom["status"],
) {
  return [
    game.snapshot.status,
    activePlayerSeat ?? "observer",
    localDirection === undefined
      ? "server"
      : (localDirection ?? "stationary"),
    roomStatus,
  ].join(":");
}

function useProjectedBattleCityMultiplayerGame(
  projectionSnapshot: BattleCityMultiplayerProjectionSnapshot,
  onProjectionReconcile: (() => void) | undefined,
) {
  const { activePlayerSeat, game, localDirection, roomStatus } =
    projectionSnapshot;

  return useClientProjectionClock({
    baseValue: game.snapshot,
    getProjectionFrameKey: getBattleCityMultiplayerProjectionFrameKey,
    isProjectionFrameAdvanced:
      isBattleCityMultiplayerProjectionFrameAdvanced,
    isProjectionEnabled: isBattleCityMultiplayerProjectionEnabled,
    onReconcile: onProjectionReconcile,
    project: projectBattleCityMultiplayerProjectionSnapshot,
    seq: game.seq,
    serverTimeMs: game.serverTimeMs,
    snapshot: projectionSnapshot,
    status: getBattleCityMultiplayerProjectionIdentity(
      game,
      activePlayerSeat,
      localDirection,
      roomStatus,
    ),
  });
}

export function createBattleCityMultiplayerInputState() {
  return createBattleCityPlayerMovementState();
}

export function pressBattleCityMultiplayerInputKey(
  state: BattleCityPlayerMovementState,
  key: string,
): BattleCityMultiplayerInputTransition {
  const movementKey = getBattleCityPlayerMovementKey(key);

  if (movementKey === null) {
    return {
      direction: state.direction,
      handled: false,
      shouldSend: false,
    };
  }

  const previousDirection = state.direction;
  const movement = pressBattleCityPlayerMovementKey(state, movementKey);

  return {
    direction: movement.direction,
    handled: true,
    shouldSend:
      movement.shouldMoveImmediately && movement.direction !== previousDirection,
  };
}

export function releaseBattleCityMultiplayerInputKey(
  state: BattleCityPlayerMovementState,
  key: string,
): BattleCityMultiplayerInputTransition {
  const movementKey = getBattleCityPlayerMovementKey(key);

  if (movementKey === null) {
    return {
      direction: state.direction,
      handled: false,
      shouldSend: false,
    };
  }

  const previousDirection = state.direction;
  const movement = releaseBattleCityPlayerMovementKey(state, movementKey);

  return {
    direction: movement.direction,
    handled: movement.handled,
    shouldSend: movement.handled && movement.direction !== previousDirection,
  };
}

export function resetBattleCityMultiplayerInputState(
  state: BattleCityPlayerMovementState,
): BattleCityMultiplayerInputTransition {
  const previousDirection = state.direction;

  resetBattleCityPlayerMovementState(state);

  return {
    direction: null,
    handled: previousDirection !== null,
    shouldSend: previousDirection !== null,
  };
}

export function handleBattleCityMultiplayerKeyDown({
  canSendGameInput,
  event,
  gameStatus,
  inputState,
  submitGameInput,
}: BattleCityMultiplayerKeyDownOptions) {
  if (!canSendGameInput || shouldIgnoreGameKeyDown(event)) {
    return false;
  }

  if (isBattleCityMultiplayerFireKey(event.key)) {
    event.preventDefault();

    if (
      !event.repeat &&
      canControlBattleCityMultiplayerPlayer(gameStatus)
    ) {
      submitGameInput({ type: "battle-city.fire" });
    }

    return true;
  }

  const transition = pressBattleCityMultiplayerInputKey(
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
      type: "battle-city.setDirection",
    });
  }

  return true;
}

export function handleBattleCityMultiplayerKeyUp({
  canSendGameInput,
  event,
  inputState,
  submitGameInput,
}: BattleCityMultiplayerKeyUpOptions) {
  if (!canSendGameInput) {
    return false;
  }

  const transition = releaseBattleCityMultiplayerInputKey(
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
      type: "battle-city.setDirection",
    });
  }

  return true;
}

export function getBattleCityMultiplayerStatusLabel(status: BattleCityStatus) {
  return statusLabels[status];
}

export function BattleCityMultiplayerRoom({
  activeParticipant,
  game,
  lifecycleControls = null,
  onGameInput,
  onProjectionReconcile,
  room,
}: BattleCityMultiplayerRoomProps) {
  const onGameInputRef = useRef(onGameInput);
  const inputStateRef = useRef(createBattleCityMultiplayerInputState());
  const [localDirection, setLocalDirection] = useState<
    BattleCityDirection | null | undefined
  >(undefined);
  const gameState = game.snapshot;
  const activeSeat = useMemo(
    () =>
      getMultiplayerActiveRoomParticipantSeat(
        room.seats,
        activeParticipant?.id ?? null,
      ),
    [activeParticipant?.id, room.seats],
  );
  const activePlayerSeat =
    activeSeat !== null && isBattleCityMultiplayerPlayerSeat(activeSeat.id)
      ? activeSeat.id
      : null;
  const activeRoomSeat = activePlayerSeat === null ? null : activeSeat;
  const canSendGameInput =
    activePlayerSeat !== null &&
    room.status === "running" &&
    canControlBattleCityMultiplayerPlayer(gameState.status);
  const projectedLocalDirection = canSendGameInput
    ? localDirection
    : undefined;
  const effectiveStatus: BattleCityStatus =
    room.status === "paused" ? "paused" : gameState.status;
  const statusLabel = getBattleCityMultiplayerStatusLabel(effectiveStatus);
  const statusAnnouncement =
    room.status === "paused"
      ? statusLabel
      : (getBattleCityMultiplayerOverlayTitle(gameState, game.summary) ??
        statusLabel);
  const sidePanels = [
    {
      content: (
        <BattleCityMultiplayerStatsPanel
          activeSeatLabel={activeRoomSeat?.label ?? "Observer"}
          gameState={gameState}
          statusAnnouncement={statusAnnouncement}
          statusLabel={statusLabel}
          summary={game.summary}
        />
      ),
      id: "battle-city-stats",
    },
  ] satisfies MultiplayerActiveRoomSidePanel[];

  useEffect(() => {
    onGameInputRef.current = onGameInput;
  }, [onGameInput]);

  const submitGameInput = useCallback(
    (input: BattleCityMultiplayerClientInput) => {
      void onGameInputRef.current(input);
    },
    [],
  );

  const resetPlayerDirectionInput = useCallback(() => {
    const transition = resetBattleCityMultiplayerInputState(
      inputStateRef.current,
    );

    if (transition.shouldSend) {
      submitGameInput({
        direction: null,
        type: "battle-city.setDirection",
      });
    }
    return transition;
  }, [submitGameInput]);

  const clearPlayerDirection = useCallback(() => {
    const transition = resetPlayerDirectionInput();
    setLocalDirection(transition.shouldSend ? null : undefined);
  }, [resetPlayerDirectionInput]);

  useEffect(() => {
    if (canSendGameInput) {
      return undefined;
    }

    const transition = resetPlayerDirectionInput();
    const timeoutId = window.setTimeout(() => {
      setLocalDirection(transition.shouldSend ? null : undefined);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [canSendGameInput, resetPlayerDirectionInput]);

  useEffect(() => {
    function handleWindowBlur() {
      clearPlayerDirection();
    }

    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      resetPlayerDirectionInput();
    };
  }, [clearPlayerDirection, resetPlayerDirectionInput]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const handled = handleBattleCityMultiplayerKeyDown({
        canSendGameInput,
        event,
        gameStatus: gameState.status,
        inputState: inputStateRef.current,
        submitGameInput,
      });

      if (handled) {
        setLocalDirection(inputStateRef.current.direction);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const handled = handleBattleCityMultiplayerKeyUp({
        canSendGameInput,
        event,
        inputState: inputStateRef.current,
        submitGameInput,
      });

      if (handled) {
        setLocalDirection(inputStateRef.current.direction);
      }
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
        <BattleCityMultiplayerProjectedBoard
          activePlayerSeat={activePlayerSeat}
          game={game}
          localDirection={projectedLocalDirection}
          onProjectionReconcile={onProjectionReconcile}
          roomStatus={room.status}
        >
          <BattleCityMultiplayerBoardOverlay
            game={game}
            isRoomPaused={room.status === "paused"}
            statusLabel={statusLabel}
          />
        </BattleCityMultiplayerProjectedBoard>
      }
      boardFrameMaxWidth="min(100%, calc(100svh - 8rem))"
      boardFrameTestId="battle-city-multiplayer-board-frame"
      lifecycleControls={lifecycleControls}
      readOnlyTestId="battle-city-multiplayer-readonly"
      roleLabelTestId="battle-city-multiplayer-role"
      rootTestId="battle-city-multiplayer-room"
      sidePanels={sidePanels}
    />
  );
}

function BattleCityMultiplayerProjectedBoard({
  activePlayerSeat,
  children,
  game,
  localDirection,
  onProjectionReconcile,
  roomStatus,
}: {
  activePlayerSeat: BattleCityMultiplayerPlayerSeat | null;
  children?: ReactNode;
  game: BattleCityMultiplayerGameSnapshot;
  localDirection: BattleCityDirection | null | undefined;
  onProjectionReconcile?: () => void;
  roomStatus: PrivateRoom["status"];
}) {
  const projectionSnapshot = useMemo(
    () => ({
      activePlayerSeat,
      game,
      localDirection,
      roomStatus,
    }),
    [activePlayerSeat, game, localDirection, roomStatus],
  );
  const projectedGame = useProjectedBattleCityMultiplayerGame(
    projectionSnapshot,
    onProjectionReconcile,
  );

  return <BattleCityBoard game={projectedGame}>{children}</BattleCityBoard>;
}

function BattleCityMultiplayerBoardOverlay({
  game,
  isRoomPaused,
  statusLabel,
}: {
  game: BattleCityMultiplayerGameSnapshot;
  isRoomPaused: boolean;
  statusLabel: string;
}) {
  const gameState = game.snapshot;

  if (isRoomPaused) {
    return (
      <div
        className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--battle-city-board)_82%,transparent)] px-4 text-center text-[var(--battle-city-board-text)] backdrop-blur-[2px]"
        data-testid="battle-city-multiplayer-paused"
      >
        <p className="text-2xl font-semibold tracking-normal">Paused</p>
      </div>
    );
  }

  if (gameState.status === "stage-results") {
    return <BattleCityMultiplayerStageResults gameState={gameState} />;
  }

  if (gameState.status === "running" || gameState.status === "stage-clear") {
    return null;
  }

  const isTerminal = gameState.status === "lost";
  const title = getBattleCityMultiplayerOverlayTitle(gameState, game.summary);

  return (
    <div
      className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--battle-city-board)_82%,transparent)] px-4 text-center text-[var(--battle-city-board-text)] backdrop-blur-[2px]"
      data-testid={
        isTerminal
          ? "battle-city-multiplayer-terminal-message"
          : `battle-city-multiplayer-${gameState.status}`
      }
    >
      <p className="text-2xl font-semibold tracking-normal">
        {title ?? statusLabel}
      </p>
    </div>
  );
}

function getBattleCityMultiplayerOverlayTitle(
  gameState: BattleCityMultiplayerGameState,
  summary: BattleCityMultiplayerTerminalSummary | undefined,
) {
  switch (gameState.status) {
    case "stage-intro":
      return `STAGE ${formatBattleCityStageLabel(gameState.stage, gameState.cycle)}`;
    case "lost":
      return summary === undefined
        ? "GAME OVER"
        : `Patrol lost · P1 ${summary.outcome.player1Score.toLocaleString("en-US")} · P2 ${summary.outcome.player2Score.toLocaleString("en-US")}`;
    case "game-over":
      return "GAME OVER";
    case "paused":
      return "Paused";
    case "ready":
      return "Ready";
    case "running":
    case "stage-clear":
    case "stage-results":
      return null;
  }
}

function BattleCityMultiplayerStageResults({
  gameState,
}: {
  gameState: BattleCityMultiplayerGameState;
}) {
  const result = getBattleCityMultiplayerStageResultDisplay(gameState);
  const stageLabel = formatBattleCityStageLabel(gameState.stage, gameState.cycle);

  return (
    <section
      aria-label={`Stage ${stageLabel} results`}
      className="absolute inset-2 flex items-center justify-center overflow-hidden rounded-[0.375rem] bg-[color-mix(in_oklch,var(--battle-city-board)_94%,black)] p-4 text-[var(--battle-city-ink)]"
      data-testid="battle-city-multiplayer-stage-results"
    >
      <div className="w-full max-w-lg rounded-md border border-[var(--battle-city-board-border)] bg-[color-mix(in_oklch,var(--battle-city-panel)_88%,transparent)] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.42)]">
        <header className="mb-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--battle-city-muted)]">
            Stage {stageLabel}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-wide">
            Battle results
          </h2>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <BattleCityMultiplayerPlayerResults
            killCounts={result.player1}
            label="Player 1"
            score={gameState.score}
            showTotal={result.showTotal}
            testIdPrefix="battle-city-multiplayer-results-player-1"
          />
          <BattleCityMultiplayerPlayerResults
            killCounts={result.player2}
            label="Player 2"
            score={gameState.player2Score}
            showTotal={result.showTotal}
            testIdPrefix="battle-city-multiplayer-results-player-2"
          />
        </div>
      </div>
    </section>
  );
}

function BattleCityMultiplayerPlayerResults({
  killCounts,
  label,
  score,
  showTotal,
  testIdPrefix,
}: {
  killCounts: BattleCityKillCounts;
  label: string;
  score: number;
  showTotal: boolean;
  testIdPrefix: string;
}) {
  const totalKills = getBattleCityMultiplayerTotalKills(killCounts);

  return (
    <section
      className="rounded-sm border border-[var(--battle-city-border)] bg-black/20 p-3"
      data-testid={testIdPrefix}
    >
      <h3 className="text-center text-sm font-semibold">{label}</h3>
      <p className="mt-1 text-center font-mono text-xs text-[var(--battle-city-results-accent)]">
        {score.toLocaleString("en-US")} pts
      </p>
      <dl className="mt-2 space-y-1 font-mono text-xs">
        {stageResultRows.map((row) => (
          <div className="flex justify-between gap-2" key={row.type}>
            <dt>{row.label}</dt>
            <dd className="tabular-nums">{killCounts[row.type]}</dd>
          </div>
        ))}
        {showTotal ? (
          <div
            className="mt-2 flex justify-between border-t border-[var(--battle-city-border)] pt-2 font-semibold text-[var(--battle-city-results-accent)]"
            data-testid={`${testIdPrefix}-total`}
          >
            <dt>Total</dt>
            <dd className="tabular-nums">{totalKills}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function getBattleCityMultiplayerTotalKills(killCounts: BattleCityKillCounts) {
  return stageResultRows.reduce(
    (total, row) => total + killCounts[row.type],
    0,
  );
}

function BattleCityMultiplayerStatsPanel({
  activeSeatLabel,
  gameState,
  statusAnnouncement,
  statusLabel,
  summary,
}: {
  activeSeatLabel: string;
  gameState: BattleCityMultiplayerGameState;
  statusAnnouncement: string;
  statusLabel: string;
  summary?: BattleCityMultiplayerTerminalSummary;
}) {
  const enemiesRemaining = Math.max(
    0,
    gameState.totalEnemyCount - gameState.spawnedEnemyCount,
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-normal">Tank Patrol</h2>
        <span
          aria-hidden="true"
          className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-accent-faint)] px-2 py-1 text-xs font-semibold uppercase tracking-normal text-[var(--chrome-ink)]"
          data-testid="battle-city-multiplayer-status"
        >
          {statusLabel}
        </span>
        <span
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          role="status"
          data-testid="battle-city-multiplayer-status-announcement"
        >
          {statusAnnouncement}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <BattleCityRoomStat
          label="P1 score"
          testId="battle-city-multiplayer-player-1-score"
          value={gameState.score.toLocaleString("en-US")}
        />
        <BattleCityRoomStat
          label="P2 score"
          testId="battle-city-multiplayer-player-2-score"
          value={gameState.player2Score.toLocaleString("en-US")}
        />
        <BattleCityRoomStat
          label="P1 reserves"
          testId="battle-city-multiplayer-player-1-lives"
          value={getBattleCityReserveLives(
            gameState.lives,
            gameState.player.phase,
          )}
        />
        <BattleCityRoomStat
          label="P2 reserves"
          testId="battle-city-multiplayer-player-2-lives"
          value={getBattleCityReserveLives(
            gameState.player2Lives,
            gameState.player2.phase,
          )}
        />
        <BattleCityRoomStat
          label="Stage"
          testId="battle-city-multiplayer-stage"
          value={formatBattleCityStageLabel(gameState.stage, gameState.cycle)}
        />
        <BattleCityRoomStat
          label="Waiting"
          testId="battle-city-multiplayer-enemies-remaining"
          value={enemiesRemaining}
        />
        <BattleCityRoomStat
          label="Active"
          testId="battle-city-multiplayer-active-seat"
          value={activeSeatLabel}
        />
      </dl>

      {summary === undefined ? null : (
        <BattleCityMultiplayerTerminalSummaryPanel summary={summary} />
      )}
    </>
  );
}

function BattleCityMultiplayerTerminalSummaryPanel({
  summary,
}: {
  summary: BattleCityMultiplayerTerminalSummary;
}) {
  return (
    <MultiplayerTerminalSummaryPanel
      rows={[
        {
          label: "Outcome",
          testId: "battle-city-multiplayer-summary-outcome",
          value: "Lost",
        },
        {
          label: "Crew",
          testId: "battle-city-multiplayer-summary-crew",
          value: getBattleCitySummaryCrewLabel(summary),
        },
        {
          label: "Player 1",
          testId: "battle-city-multiplayer-summary-player-1",
          value: `${summary.outcome.player1Score.toLocaleString("en-US")} pts · ${summary.outcome.player1ReserveLives} reserves`,
        },
        {
          label: "Player 2",
          testId: "battle-city-multiplayer-summary-player-2",
          value: `${summary.outcome.player2Score.toLocaleString("en-US")} pts · ${summary.outcome.player2ReserveLives} reserves`,
        },
        {
          label: "Stage",
          testId: "battle-city-multiplayer-summary-stage",
          value: formatBattleCityStageLabel(
            summary.outcome.stage,
            summary.outcome.cycle,
          ),
        },
        {
          label: "Key",
          testId: "battle-city-multiplayer-summary-key",
          value: summary.key,
        },
      ]}
      testId="battle-city-multiplayer-terminal-summary"
    />
  );
}

function getBattleCitySummaryCrewLabel(
  summary: BattleCityMultiplayerTerminalSummary,
) {
  return summary.seats
    .map((seat) => {
      const playerLabel = seat.participant?.displayName ?? "Open";

      return `${playerLabel} · ${seat.label}`;
    })
    .join(" / ");
}

function BattleCityRoomStat({
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
      <dd
        className="mt-1 text-2xl font-semibold tracking-normal"
        data-testid={testId}
      >
        {value}
      </dd>
    </div>
  );
}
