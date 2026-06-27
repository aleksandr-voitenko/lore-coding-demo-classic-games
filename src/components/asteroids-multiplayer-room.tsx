"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import {
  AsteroidsBoard,
  type AsteroidsBoardShipRenderState,
} from "@/components/asteroids-board";
import { useClientProjectionClock } from "@/components/client-projection-clock";
import {
  createAsteroidsControlState,
  getAsteroidsControlInput,
  getAsteroidsControlKey,
  pressAsteroidsControlKey,
  releaseAsteroidsControlKey,
  resetAsteroidsControlState,
  type AsteroidsControlState,
} from "@/components/asteroids-player-input";
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
import type {
  AsteroidsControlInput,
  AsteroidsGameState,
  AsteroidsStatus,
} from "@/lib/asteroids-game-engine";
import {
  ASTEROIDS_MULTIPLAYER_SHIP_SEATS,
  getAsteroidsMultiplayerProjectionTicks,
  isAsteroidsShipSeat,
  projectAsteroidsMultiplayerGame,
  type AsteroidsMultiplayerClientInput,
  type AsteroidsMultiplayerGameSnapshot,
  type AsteroidsMultiplayerGameState,
  type AsteroidsMultiplayerHeldInput,
  type AsteroidsMultiplayerHeldInputs,
  type AsteroidsMultiplayerTerminalSummary,
  type AsteroidsShipSeat,
} from "@/lib/asteroids-multiplayer";
import type {
  PrivateRoom,
  PrivateRoomParticipant,
} from "@/lib/multiplayer/room";

type AsteroidsMultiplayerRoomProps = {
  activeParticipant: PrivateRoomParticipant | null;
  game: AsteroidsMultiplayerGameSnapshot;
  lifecycleControls?: ReactNode;
  onGameInput: (
    input: AsteroidsMultiplayerClientInput,
  ) => void | Promise<void>;
  room: PrivateRoom;
};

type AsteroidsMultiplayerKeyboardEvent = Pick<
  KeyboardEvent,
  "key" | "preventDefault" | "repeat" | "target"
>;

export type AsteroidsMultiplayerInputTransition = {
  controls: AsteroidsControlInput;
  handled: boolean;
  shouldSend: boolean;
};

type AsteroidsMultiplayerKeyDownOptions = {
  canSendGameInput: boolean;
  event: AsteroidsMultiplayerKeyboardEvent;
  gameStatus: AsteroidsStatus;
  inputState: AsteroidsControlState;
  submitGameInput: (input: AsteroidsMultiplayerClientInput) => void;
};

type AsteroidsMultiplayerKeyUpOptions = {
  canSendGameInput: boolean;
  event: Pick<KeyboardEvent, "key" | "preventDefault">;
  inputState: AsteroidsControlState;
  submitGameInput: (input: AsteroidsMultiplayerClientInput) => void;
};

const statusLabels = {
  lost: "Lost",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
} satisfies Record<AsteroidsStatus, string>;

export type AsteroidsMultiplayerProjectionSnapshot = {
  activeShipSeat: AsteroidsShipSeat | null;
  game: AsteroidsMultiplayerGameSnapshot;
  getLocalControls: () => AsteroidsControlInput;
};

function isAsteroidsMultiplayerFireKey(key: string) {
  return key === " ";
}

function isAsteroidsMultiplayerProjectionEnabled({
  game,
}: AsteroidsMultiplayerProjectionSnapshot) {
  return game.snapshot.status === "running";
}

export function getAsteroidsMultiplayerProjectionFrameKey(
  snapshot: AsteroidsMultiplayerProjectionSnapshot,
  elapsedMs: number,
) {
  const projectionTicks = getAsteroidsMultiplayerProjectionTicks(elapsedMs);

  if (snapshot.activeShipSeat === null) {
    return `server:${projectionTicks}`;
  }

  return [
    snapshot.activeShipSeat,
    projectionTicks,
    getAsteroidsMultiplayerControlsKey(snapshot.getLocalControls()),
  ].join(":");
}

function getAsteroidsMultiplayerProjectionStatusKey(
  game: AsteroidsMultiplayerGameSnapshot,
  activeShipSeat: AsteroidsShipSeat | null,
) {
  return `${game.snapshot.status}:${activeShipSeat ?? "server"}`;
}

export function projectAsteroidsMultiplayerSnapshot(
  snapshot: AsteroidsMultiplayerProjectionSnapshot,
  elapsedMs: number,
) {
  return projectAsteroidsMultiplayerGame(
    snapshot.game.snapshot,
    getAsteroidsMultiplayerProjectionHeldInputs(
      snapshot.game.heldInputs,
      snapshot.activeShipSeat,
      snapshot.getLocalControls(),
    ),
    elapsedMs,
  );
}

function useProjectedAsteroidsMultiplayerGame(
  projectionSnapshot: AsteroidsMultiplayerProjectionSnapshot,
) {
  return useClientProjectionClock({
    baseValue: projectionSnapshot.game.snapshot,
    getProjectionFrameKey: getAsteroidsMultiplayerProjectionFrameKey,
    isProjectionEnabled: isAsteroidsMultiplayerProjectionEnabled,
    project: projectAsteroidsMultiplayerSnapshot,
    seq: projectionSnapshot.game.seq,
    serverTimeMs: projectionSnapshot.game.serverTimeMs,
    snapshot: projectionSnapshot,
    status: getAsteroidsMultiplayerProjectionStatusKey(
      projectionSnapshot.game,
      projectionSnapshot.activeShipSeat,
    ),
  });
}

export function getAsteroidsMultiplayerProjectionHeldInputs(
  heldInputs: AsteroidsMultiplayerHeldInputs,
  activeShipSeat: AsteroidsShipSeat | null,
  localControls: AsteroidsControlInput,
): AsteroidsMultiplayerHeldInputs {
  if (activeShipSeat === null) {
    return heldInputs;
  }

  const localHeldInput =
    getAsteroidsMultiplayerHeldInputForControls(localControls);

  if (
    areAsteroidsMultiplayerHeldInputsEqual(
      heldInputs[activeShipSeat],
      localHeldInput,
    )
  ) {
    return heldInputs;
  }

  const projectedHeldInputs: Partial<
    Record<AsteroidsShipSeat, AsteroidsMultiplayerHeldInput>
  > = { ...heldInputs };

  if (localHeldInput === undefined) {
    delete projectedHeldInputs[activeShipSeat];
  } else {
    projectedHeldInputs[activeShipSeat] = localHeldInput;
  }

  return projectedHeldInputs;
}

function getAsteroidsMultiplayerHeldInputForControls(
  controls: AsteroidsControlInput,
): AsteroidsMultiplayerHeldInput | undefined {
  const heldInput = {
    ...(controls.rotateLeft === true ? { rotateLeft: true } : {}),
    ...(controls.rotateRight === true ? { rotateRight: true } : {}),
    ...(controls.thrust === true ? { thrust: true } : {}),
  } satisfies AsteroidsMultiplayerHeldInput;

  return Object.keys(heldInput).length === 0 ? undefined : heldInput;
}

function getAsteroidsMultiplayerControlsKey(controls: AsteroidsControlInput) {
  return [
    controls.rotateLeft === true ? "L" : "-",
    controls.rotateRight === true ? "R" : "-",
    controls.thrust === true ? "T" : "-",
  ].join("");
}

function areAsteroidsMultiplayerHeldInputsEqual(
  left: AsteroidsMultiplayerHeldInput | undefined,
  right: AsteroidsMultiplayerHeldInput | undefined,
) {
  return (
    left?.fire === right?.fire &&
    left?.rotateLeft === right?.rotateLeft &&
    left?.rotateRight === right?.rotateRight &&
    left?.thrust === right?.thrust
  );
}

export function createAsteroidsMultiplayerInputState() {
  return createAsteroidsControlState();
}

export function pressAsteroidsMultiplayerInputKey(
  state: AsteroidsControlState,
  key: string,
): AsteroidsMultiplayerInputTransition {
  const controlKey = getAsteroidsControlKey(key);
  const previousControls = getAsteroidsControlInput(state);

  if (controlKey === null) {
    return {
      controls: previousControls,
      handled: false,
      shouldSend: false,
    };
  }

  pressAsteroidsControlKey(state, controlKey);

  const controls = getAsteroidsControlInput(state);

  return {
    controls,
    handled: true,
    shouldSend: !areAsteroidsControlInputsEqual(previousControls, controls),
  };
}

export function releaseAsteroidsMultiplayerInputKey(
  state: AsteroidsControlState,
  key: string,
): AsteroidsMultiplayerInputTransition {
  const controlKey = getAsteroidsControlKey(key);
  const previousControls = getAsteroidsControlInput(state);

  if (controlKey === null) {
    return {
      controls: previousControls,
      handled: false,
      shouldSend: false,
    };
  }

  const handled = releaseAsteroidsControlKey(state, controlKey);
  const controls = getAsteroidsControlInput(state);

  return {
    controls,
    handled,
    shouldSend: handled && !areAsteroidsControlInputsEqual(previousControls, controls),
  };
}

export function resetAsteroidsMultiplayerInputState(
  state: AsteroidsControlState,
): AsteroidsMultiplayerInputTransition {
  const previousControls = getAsteroidsControlInput(state);

  resetAsteroidsControlState(state);

  const controls = getAsteroidsControlInput(state);
  const changed = !areAsteroidsControlInputsEqual(previousControls, controls);

  return {
    controls,
    handled: changed,
    shouldSend: changed,
  };
}

export function handleAsteroidsMultiplayerKeyDown({
  canSendGameInput,
  event,
  gameStatus,
  inputState,
  submitGameInput,
}: AsteroidsMultiplayerKeyDownOptions) {
  if (!canSendGameInput || shouldIgnoreGameKeyDown(event)) {
    return false;
  }

  if (isAsteroidsMultiplayerFireKey(event.key)) {
    event.preventDefault();

    if (!event.repeat && gameStatus === "running") {
      submitGameInput({ type: "asteroids.fire" });
    }

    return true;
  }

  const transition = pressAsteroidsMultiplayerInputKey(
    inputState,
    event.key,
  );

  if (!transition.handled) {
    return false;
  }

  event.preventDefault();

  if (transition.shouldSend) {
    submitGameInput({
      controls: transition.controls,
      type: "asteroids.setShipControls",
    });
  }

  return true;
}

export function handleAsteroidsMultiplayerKeyUp({
  canSendGameInput,
  event,
  inputState,
  submitGameInput,
}: AsteroidsMultiplayerKeyUpOptions) {
  if (!canSendGameInput) {
    return false;
  }

  const transition = releaseAsteroidsMultiplayerInputKey(
    inputState,
    event.key,
  );

  if (!transition.handled) {
    return false;
  }

  event.preventDefault();

  if (transition.shouldSend) {
    submitGameInput({
      controls: transition.controls,
      type: "asteroids.setShipControls",
    });
  }

  return true;
}

export function getAsteroidsMultiplayerStatusLabel(status: AsteroidsStatus) {
  return statusLabels[status];
}

export function getAsteroidsMultiplayerBoardFrameMaxWidth(
  game: AsteroidsMultiplayerGameSnapshot,
) {
  const boardAspectRatio = game.snapshot.boardWidth / game.snapshot.boardHeight;

  return `min(100%, calc((100svh - 8rem) * ${boardAspectRatio}))`;
}

export function AsteroidsMultiplayerRoom({
  activeParticipant,
  game,
  lifecycleControls = null,
  onGameInput,
  room,
}: AsteroidsMultiplayerRoomProps) {
  const onGameInputRef = useRef(onGameInput);
  const inputStateRef = useRef(createAsteroidsMultiplayerInputState());
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
    activeSeat !== null && isAsteroidsShipSeat(activeSeat.id)
      ? activeSeat.id
      : null;
  const activeRoomSeat = activeShipSeat === null ? null : activeSeat;
  const primaryBoardSeat = activeShipSeat ?? "ship-a";
  const canSendGameInput = activeShipSeat !== null && gameState.status === "running";
  const statusLabel = getAsteroidsMultiplayerStatusLabel(gameState.status);
  const boardFrameMaxWidth = getAsteroidsMultiplayerBoardFrameMaxWidth(game);
  const getLocalControls = useCallback(
    () => getAsteroidsControlInput(inputStateRef.current),
    [],
  );
  const sidePanels = [
    {
      content: (
        <AsteroidsMultiplayerStatsPanel
          activeSeatLabel={activeRoomSeat?.label ?? "Observer"}
          gameState={gameState}
          statusLabel={statusLabel}
          summary={game.summary}
        />
      ),
      id: "asteroids-stats",
    },
  ] satisfies MultiplayerActiveRoomSidePanel[];

  useEffect(() => {
    onGameInputRef.current = onGameInput;
  }, [onGameInput]);

  const submitGameInput = useCallback((input: AsteroidsMultiplayerClientInput) => {
    void onGameInputRef.current(input);
  }, []);

  const clearShipControls = useCallback(() => {
    const transition = resetAsteroidsMultiplayerInputState(
      inputStateRef.current,
    );

    if (transition.shouldSend) {
      submitGameInput({
        controls: transition.controls,
        type: "asteroids.setShipControls",
      });
    }
  }, [submitGameInput]);

  useEffect(() => {
    if (!canSendGameInput) {
      clearShipControls();
    }
  }, [canSendGameInput, clearShipControls]);

  useEffect(() => {
    function handleWindowBlur() {
      clearShipControls();
    }

    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      clearShipControls();
    };
  }, [clearShipControls]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      handleAsteroidsMultiplayerKeyDown({
        canSendGameInput,
        event,
        gameStatus: gameState.status,
        inputState: inputStateRef.current,
        submitGameInput,
      });
    }

    function handleKeyUp(event: KeyboardEvent) {
      handleAsteroidsMultiplayerKeyUp({
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
        <AsteroidsMultiplayerProjectedBoard
          activeShipSeat={activeShipSeat}
          game={game}
          getLocalControls={getLocalControls}
          primaryBoardSeat={primaryBoardSeat}
          statusLabel={statusLabel}
        >
          {gameState.status === "paused" ? (
            <div
              className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--asteroids-board)_76%,transparent)] text-center text-[var(--asteroids-board-text)] backdrop-blur-[2px]"
              data-testid="asteroids-multiplayer-paused-message"
            >
              <p className="text-2xl font-semibold tracking-normal">Paused</p>
            </div>
          ) : null}

          {gameState.status === "lost" ? (
            <div
              className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--asteroids-board)_76%,transparent)] px-4 text-center text-[var(--asteroids-board-text)] backdrop-blur-[2px]"
              data-testid="asteroids-multiplayer-terminal-message"
            >
              <p className="text-2xl font-semibold tracking-normal">
                {getAsteroidsMultiplayerTerminalMessage(
                  game.summary,
                  statusLabel,
                )}
              </p>
            </div>
          ) : null}
        </AsteroidsMultiplayerProjectedBoard>
      }
      boardFrameMaxWidth={boardFrameMaxWidth}
      boardFrameTestId="asteroids-multiplayer-board-frame"
      lifecycleControls={lifecycleControls}
      readOnlyTestId="asteroids-multiplayer-readonly"
      roleLabelTestId="asteroids-multiplayer-role"
      rootTestId="asteroids-multiplayer-room"
      sidePanels={sidePanels}
    />
  );
}

function AsteroidsMultiplayerProjectedBoard({
  activeShipSeat,
  children,
  game,
  getLocalControls,
  primaryBoardSeat,
  statusLabel,
}: {
  activeShipSeat: AsteroidsShipSeat | null;
  children?: ReactNode;
  game: AsteroidsMultiplayerGameSnapshot;
  getLocalControls: () => AsteroidsControlInput;
  primaryBoardSeat: AsteroidsShipSeat;
  statusLabel: string;
}) {
  const projectionSnapshot = useMemo(
    () => ({
      activeShipSeat,
      game,
      getLocalControls,
    }),
    [activeShipSeat, game, getLocalControls],
  );
  const projectedGame = useProjectedAsteroidsMultiplayerGame(projectionSnapshot);
  const boardGame = getAsteroidsMultiplayerBoardGame(
    projectedGame,
    primaryBoardSeat,
  );
  const shipRenderStates =
    getAsteroidsMultiplayerBoardShipRenderStates(projectedGame);

  return (
    <AsteroidsBoard
      game={boardGame}
      shipRenderStates={shipRenderStates}
      statusLabel={statusLabel}
    >
      {children}
    </AsteroidsBoard>
  );
}

function areAsteroidsControlInputsEqual(
  left: AsteroidsControlInput,
  right: AsteroidsControlInput,
) {
  return (
    left.rotateLeft === right.rotateLeft &&
    left.rotateRight === right.rotateRight &&
    left.thrust === right.thrust
  );
}

function getAsteroidsMultiplayerBoardGame(
  gameState: AsteroidsMultiplayerGameState,
  primarySeat: AsteroidsShipSeat,
): AsteroidsGameState {
  const { ships, ...sharedGameState } = gameState;
  const shipState = ships[primarySeat];

  return {
    ...sharedGameState,
    bulletSpeedMultiplier: shipState.bulletSpeedMultiplier,
    bullets: shipState.bullets,
    engineSpeedMultiplier: shipState.engineSpeedMultiplier,
    respawnInvulnerabilityTicks: shipState.respawnInvulnerabilityTicks,
    ship: shipState.ship,
    shipExplosion: shipState.shipExplosion,
    shotCooldownTicks: shipState.shotCooldownTicks,
    shotIntervalMultiplier: shipState.shotIntervalMultiplier,
  };
}

function getAsteroidsMultiplayerBoardShipRenderStates(
  gameState: AsteroidsMultiplayerGameState,
): AsteroidsBoardShipRenderState[] {
  return ASTEROIDS_MULTIPLAYER_SHIP_SEATS.map((seat) => {
    const shipState = gameState.ships[seat];

    return {
      bullets: shipState.bullets,
      id: seat,
      isActive: shipState.isActive,
      label: getAsteroidsShipSeatLabel(seat),
      respawnInvulnerabilityTicks: shipState.respawnInvulnerabilityTicks,
      ship: shipState.ship,
      shipExplosion: shipState.shipExplosion,
    };
  });
}

function getAsteroidsShipSeatLabel(seat: AsteroidsShipSeat) {
  return seat === "ship-a" ? "Ship A" : "Ship B";
}

function AsteroidsMultiplayerStatsPanel({
  activeSeatLabel,
  gameState,
  statusLabel,
  summary,
}: {
  activeSeatLabel: string;
  gameState: AsteroidsMultiplayerGameState;
  statusLabel: string;
  summary?: AsteroidsMultiplayerTerminalSummary;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-normal">Asteroids</h2>
        <span
          className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-accent-faint)] px-2 py-1 text-xs font-semibold uppercase tracking-normal text-[var(--chrome-ink)]"
          data-testid="asteroids-multiplayer-status"
        >
          {statusLabel}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <AsteroidsRoomStat
          label="Score"
          testId="asteroids-multiplayer-score"
          value={gameState.score}
        />
        <AsteroidsRoomStat
          label="Lives"
          testId="asteroids-multiplayer-lives"
          value={gameState.lives}
        />
        <AsteroidsRoomStat
          label="Wave"
          testId="asteroids-multiplayer-wave"
          value={gameState.wave}
        />
        <AsteroidsRoomStat
          label="Active"
          testId="asteroids-multiplayer-active-seat"
          value={activeSeatLabel}
        />
      </dl>

      {summary === undefined ? null : (
        <AsteroidsMultiplayerTerminalSummaryPanel summary={summary} />
      )}
    </>
  );
}

function getAsteroidsMultiplayerTerminalMessage(
  summary: AsteroidsMultiplayerTerminalSummary | undefined,
  statusLabel: string,
) {
  if (summary === undefined) {
    return statusLabel;
  }

  return `Run lost · ${summary.outcome.score} points`;
}

function AsteroidsMultiplayerTerminalSummaryPanel({
  summary,
}: {
  summary: AsteroidsMultiplayerTerminalSummary;
}) {
  return (
    <MultiplayerTerminalSummaryPanel
      rows={[
        {
          label: "Outcome",
          testId: "asteroids-multiplayer-summary-outcome",
          value: "Lost",
        },
        {
          label: "Crew",
          testId: "asteroids-multiplayer-summary-crew",
          value: getAsteroidsSummaryCrewLabel(summary),
        },
        {
          label: "Score",
          testId: "asteroids-multiplayer-summary-score",
          value: String(summary.outcome.score),
        },
        {
          label: "Wave",
          testId: "asteroids-multiplayer-summary-wave",
          value: String(summary.outcome.wave),
        },
        {
          label: "Lives",
          testId: "asteroids-multiplayer-summary-lives",
          value: String(summary.outcome.livesRemaining),
        },
        {
          label: "Key",
          testId: "asteroids-multiplayer-summary-key",
          value: summary.key,
        },
      ]}
      testId="asteroids-multiplayer-terminal-summary"
    />
  );
}

function getAsteroidsSummaryCrewLabel(
  summary: AsteroidsMultiplayerTerminalSummary,
) {
  return summary.seats
    .map((seat) => {
      const playerLabel = seat.participant?.displayName ?? "Open";

      return `${playerLabel} · ${seat.label}`;
    })
    .join(" / ");
}

function AsteroidsRoomStat({
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
