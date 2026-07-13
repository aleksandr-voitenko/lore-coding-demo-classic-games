"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BattleCityBoard } from "@/components/battle-city-board";
import { BattleCityStageResults } from "@/components/battle-city-stage-results";
import {
  createBattleCityPlayerMovementState,
  getBattleCityPlayerMovementKey,
  pressBattleCityPlayerMovementKey,
  releaseBattleCityPlayerMovementKey,
  resetBattleCityPlayerMovementState,
  type BattleCityPlayerMovementKey,
} from "@/components/battle-city-player-input";
import {
  isGamePauseKey,
  registerGameKeyDown,
  registerGameKeyUp,
  shouldIgnoreGameKeyDown,
} from "@/components/game-input";
import { GameLeaderboardPanel } from "@/components/game-leaderboard";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import {
  GameAbandonDialog,
  GameBoardActions,
  GameBoardColumn,
  GameBoardStage,
  GameEndLeaderboardContent,
  GameEndScreen,
  GameHeader,
  GameHelpScreen,
  GameShell,
  GameSidebar,
  GameStartScreen,
  GameStartScreenHeader,
  GameStatsBar,
  GameStatCard,
  useGameEscapeToMenu,
  useGameHelpScreen,
  type GameHelpSection,
} from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import { useGameSession } from "@/hooks/use-game-session";
import {
  advanceBattleCityGame,
  BATTLE_CITY_STAGE_COUNT,
  BATTLE_CITY_TICK_MS,
  createInitialBattleCityGame,
  formatBattleCityStageLabel,
  getBattleCityStageResultDisplay,
  pauseBattleCityGame,
  restartBattleCityGame,
  resumeBattleCityGame,
  startBattleCityGame,
  type BattleCityGameState,
  type BattleCityStatus,
} from "@/lib/battle-city-game-engine";
import { accumulateBattleCityFixedStep } from "@/lib/battle-city/fixed-step";
import {
  BATTLE_CITY_PLAYER_ASSET_BY_POWER_TIER,
  getBattleCityAssetUrl,
} from "@/lib/battle-city/assets";
import { getGameCatalogEntry } from "@/lib/game-catalog";
import { createGameLeaderboardKey } from "@/lib/leaderboard";

type BattleCityGameProps = {
  onBackToMenu?: () => void;
};

const BATTLE_CITY_DISPLAY_NAME = getGameCatalogEntry("battle-city").label;

const BATTLE_CITY_LEADERBOARD_KEY = createGameLeaderboardKey("battle-city", [
  { name: "mode", value: "campaign" },
]);

const BATTLE_CITY_STATUS_LABELS: Record<BattleCityStatus, string> = {
  "game-over": "Game over",
  lost: "Game over",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
  "stage-clear": "Stage clear",
  "stage-intro": "Stage intro",
  "stage-results": "Stage results",
};

const BATTLE_CITY_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [
          { icon: ArrowUpIcon, label: "Up" },
          { icon: ArrowRightIcon, label: "Right" },
          { icon: ArrowDownIcon, label: "Down" },
          { icon: ArrowLeftIcon, label: "Left" },
          { text: "WASD", label: "W A S D keys" },
        ],
        label: "Hold to move and turn",
      },
      {
        buttons: [{ text: "Space", label: "Space key" }],
        label: "Fire",
      },
      {
        buttons: [{ text: "P", label: "P key" }],
        label: "Pause or resume",
      },
    ],
  },
  {
    title: "Rules",
    items: [
      "Destroy all 20 enemy tanks while protecting the phoenix headquarters.",
      "Shells carve up to four brick fragments across their impact face; steel needs a fully upgraded shell.",
      "Water blocks tanks, forest hides them, and ice keeps you sliding briefly.",
      "Flashing enemies reveal one of six power-ups when hit.",
      "An unshielded enemy shell costs a life; any shell that reaches the headquarters ends the run.",
      "Stages 36–70 reuse the 35 maps with the final enemy mix, then reset to Stage 1.",
      "After every battle, the original per-tank score tally appears before the next stage or game over.",
      "Before a new campaign, use Space/Up/Right to advance, B/Down/Left to go back, then press Enter.",
    ],
  },
];

function isBattleCityStartKey(key: string) {
  return key === "Enter";
}

function isBattleCityFireKey(key: string) {
  return key === " ";
}

function getBattleCityStageSelectionDelta(key: string): -1 | 0 | 1 {
  if (key === " " || key === "ArrowUp" || key === "ArrowRight") {
    return 1;
  }
  if (key === "b" || key === "B" || key === "ArrowDown" || key === "ArrowLeft") {
    return -1;
  }
  return 0;
}

export function BattleCityGame({ onBackToMenu }: BattleCityGameProps = {}) {
  const [game, setGame] = useState<BattleCityGameState>(() =>
    createInitialBattleCityGame(),
  );
  const [hasEnteredGame, setHasEnteredGame] = useState(false);
  const gameRef = useRef(game);
  const fireRequestedRef = useRef(false);
  const movementStateRef = useRef(createBattleCityPlayerMovementState());
  const statusLabel = BATTLE_CITY_STATUS_LABELS[game.status];
  const stageLabel = formatBattleCityStageLabel(game.stage, game.cycle);
  const stageResultDisplay = getBattleCityStageResultDisplay(game);
  const enemiesRemaining = Math.max(
    0,
    game.totalEnemyCount - game.spawnedEnemyCount,
  );
  const reserveLives = Math.max(0, game.lives - 1);
  const showStartScreen = !hasEnteredGame && game.status === "ready";
  const showEndScreen = game.status === "lost";
  const canPauseGame = game.status === "running" || game.status === "paused";
  const isRunInProgress = hasEnteredGame && game.status !== "lost";
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const isSimulationActive =
    game.status === "running" ||
    game.status === "stage-clear" ||
    game.status === "game-over" ||
    game.status === "stage-results" ||
    game.status === "stage-intro";
  const isFrameClockActive =
    isSimulationActive ||
    game.status === "paused" ||
    game.status === "ready";

  const { completedSessionId } = useGameSession({
    active: isSimulationActive,
    finalResult: game.status === "lost" ? "lost" : null,
    finalScore: game.score,
    gameId: "battle-city",
    leaderboardKey: BATTLE_CITY_LEADERBOARD_KEY,
    started: hasEnteredGame,
  });
  const {
    finalLeaderboardProps,
    leaderboardPanelProps,
    pendingLeaderboardEntry,
    resetLeaderboardForm,
    scoreFormProps,
  } = useGameLeaderboardPresenter({
    gameSessionId: completedSessionId,
    leaderboardKey: BATTLE_CITY_LEADERBOARD_KEY,
    pendingScore: showEndScreen ? game.score : null,
    testIdPrefix: "battle-city",
  });

  const commitGame = useCallback((nextGame: BattleCityGameState) => {
    gameRef.current = nextGame;
    setGame(nextGame);
  }, []);

  const updateCommittedGame = useCallback(
    (updateGame: (current: BattleCityGameState) => BattleCityGameState) => {
      const current = gameRef.current;
      const nextGame = updateGame(current);

      if (nextGame !== current) {
        commitGame(nextGame);
      }

      return nextGame;
    },
    [commitGame],
  );

  const enterGame = useCallback(() => {
    resetLeaderboardForm();
    setHasEnteredGame(true);
    updateCommittedGame(startBattleCityGame);
  }, [resetLeaderboardForm, updateCommittedGame]);

  const selectReadyStage = useCallback(
    (delta: -1 | 1) => {
      updateCommittedGame((current) => {
        if (current.status !== "ready") {
          return current;
        }
        const stage = Math.min(
          BATTLE_CITY_STAGE_COUNT,
          Math.max(1, current.stage + delta),
        );
        if (stage === current.stage) {
          return current;
        }
        return createInitialBattleCityGame({ stage });
      });
    },
    [updateCommittedGame],
  );

  const toggleRunState = useCallback(() => {
    resetLeaderboardForm();
    updateCommittedGame((current) => {
      if (current.status === "running") {
        return pauseBattleCityGame(current);
      }

      if (current.status === "paused") {
        return resumeBattleCityGame(current);
      }

      return current;
    });
  }, [resetLeaderboardForm, updateCommittedGame]);

  const requestPlayerFire = useCallback(() => {
    fireRequestedRef.current = true;
  }, []);

  const advanceGameFrames = useCallback((frameCount: number) => {
    updateCommittedGame((current) => {
      let next = current;
      for (let frame = 0; frame < frameCount; frame += 1) {
        const fireRequested = fireRequestedRef.current;
        fireRequestedRef.current = false;
        next = advanceBattleCityGame(
          next,
          BATTLE_CITY_TICK_MS,
          Math.random,
          {
            direction: movementStateRef.current.direction,
            fireRequested,
          },
        );
      }
      return next;
    });
  }, [updateCommittedGame]);

  const pauseGameForOverlay = useCallback(() => {
    updateCommittedGame(pauseBattleCityGame);
  }, [updateCommittedGame]);

  const resumeGameAfterOverlay = useCallback(() => {
    updateCommittedGame(resumeBattleCityGame);
  }, [updateCommittedGame]);

  const { closeHelp, isHelpVisible, openHelp } = useGameHelpScreen({
    isGameActive: game.status === "running",
    onPauseGame: pauseGameForOverlay,
    onResumeGame: resumeGameAfterOverlay,
  });
  const { abandonDialogProps, requestBackToMenu } = useGameEscapeToMenu({
    isDisabled: isHelpVisible,
    isGameStarted: isRunInProgress,
    onBackToMenu,
    onPauseGame: pauseGameForOverlay,
    onResumeGame: resumeGameAfterOverlay,
    shouldPauseBeforeConfirm: game.status === "running",
  });
  const isAbandonDialogVisible = abandonDialogProps !== null;

  const beginMovement = useCallback(
    (movementKey: BattleCityPlayerMovementKey) => {
      pressBattleCityPlayerMovementKey(movementStateRef.current, movementKey);
    },
    [],
  );

  const endMovement = useCallback(
    (movementKey: BattleCityPlayerMovementKey) =>
      releaseBattleCityPlayerMovementKey(
        movementStateRef.current,
        movementKey,
      ).handled,
    [],
  );

  const resetMovement = useCallback(() => {
    fireRequestedRef.current = false;
    resetBattleCityPlayerMovementState(movementStateRef.current);
  }, []);

  const isMovementDisabled =
    isHelpVisible ||
    isAbandonDialogVisible ||
    pendingLeaderboardEntry !== null ||
    (game.status !== "running" && game.status !== "stage-clear");

  useEffect(() => {
    if (isMovementDisabled) {
      resetMovement();
    }
  }, [isMovementDisabled, resetMovement]);

  useEffect(() => {
    window.addEventListener("blur", resetMovement);

    return () => {
      window.removeEventListener("blur", resetMovement);
      resetMovement();
    };
  }, [resetMovement]);

  const restartGame = useCallback(() => {
    resetMovement();
    resetLeaderboardForm();
    setHasEnteredGame(true);
    commitGame(startBattleCityGame(restartBattleCityGame(gameRef.current)));
  }, [commitGame, resetLeaderboardForm, resetMovement]);

  const showNewCampaignSelector = useCallback(() => {
    resetMovement();
    resetLeaderboardForm();
    setHasEnteredGame(false);
    commitGame(createInitialBattleCityGame());
  }, [commitGame, resetLeaderboardForm, resetMovement]);

  useEffect(() => {
    if (
      isHelpVisible ||
      isAbandonDialogVisible ||
      !isFrameClockActive
    ) {
      return;
    }

    let animationFrame = 0;
    let previousTimestamp: number | null = null;
    let remainderMs = 0;

    function advanceAtNtscRate(timestamp: number) {
      if (previousTimestamp !== null) {
        const fixedStep = accumulateBattleCityFixedStep(
          remainderMs,
          timestamp - previousTimestamp,
        );
        remainderMs = fixedStep.remainderMs;
        if (fixedStep.frames > 0) {
          advanceGameFrames(fixedStep.frames);
        }
      }
      previousTimestamp = timestamp;
      animationFrame = window.requestAnimationFrame(advanceAtNtscRate);
    }

    animationFrame = window.requestAnimationFrame(advanceAtNtscRate);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    advanceGameFrames,
    isAbandonDialogVisible,
    isFrameClockActive,
    isHelpVisible,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isAbandonDialogVisible) {
        return;
      }

      if (
        shouldIgnoreGameKeyDown(event, {
          hasPendingLeaderboardEntry: pendingLeaderboardEntry !== null,
          isHelpVisible,
        })
      ) {
        return;
      }

      if (showStartScreen) {
        if (isBattleCityStartKey(event.key)) {
          event.preventDefault();
          if (!event.repeat) {
            enterGame();
          }
          return;
        }

        const stageDelta = getBattleCityStageSelectionDelta(event.key);
        if (stageDelta !== 0) {
          event.preventDefault();
          selectReadyStage(stageDelta);
          return;
        }
      }

      const movementKey = getBattleCityPlayerMovementKey(event.key);

      if (movementKey !== null) {
        event.preventDefault();
        if (game.status === "running" || game.status === "stage-clear") {
          beginMovement(movementKey);
        }
        return;
      }

      if (
        isBattleCityFireKey(event.key) &&
        (game.status === "running" || game.status === "stage-clear")
      ) {
        event.preventDefault();
        if (!event.repeat) {
          requestPlayerFire();
        }
        return;
      }

      if (isGamePauseKey(event.key) && canPauseGame) {
        event.preventDefault();
        if (!event.repeat) {
          toggleRunState();
        }
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const movementKey = getBattleCityPlayerMovementKey(event.key);

      if (movementKey === null) {
        return;
      }

      if (endMovement(movementKey as BattleCityPlayerMovementKey)) {
        event.preventDefault();
      }
    }

    const unregisterKeyDown = registerGameKeyDown(handleKeyDown);
    const unregisterKeyUp = registerGameKeyUp(handleKeyUp);

    return () => {
      unregisterKeyDown();
      unregisterKeyUp();
    };
  }, [
    beginMovement,
    canPauseGame,
    endMovement,
    enterGame,
    game.status,
    isAbandonDialogVisible,
    isHelpVisible,
    pendingLeaderboardEntry,
    requestPlayerFire,
    selectReadyStage,
    showStartScreen,
    toggleRunState,
  ]);

  return (
    <GameShell className="bg-[var(--battle-city-page)] text-[var(--battle-city-ink)]">
      <GameBoardColumn className="w-[min(92vw,42rem,calc(100svh_-_12rem))]">
        <GameSidebar className="border-[var(--battle-city-border)] bg-[var(--battle-city-panel)]">
          <GameHeader
            status={statusLabel}
            statusTestId="battle-city-status"
            title={BATTLE_CITY_DISPLAY_NAME}
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--battle-city-border)]"
              label="Score"
              labelClassName="text-[var(--battle-city-muted)]"
              value={game.score.toLocaleString("en-US")}
              valueTestId="battle-city-score"
            />
            <GameStatCard
              className="border-[var(--battle-city-border)]"
              label="Stage"
              labelClassName="text-[var(--battle-city-muted)]"
              value={stageLabel}
              valueTestId="battle-city-stage"
            />
            <GameStatCard
              className="border-[var(--battle-city-border)]"
              label="Lives"
              labelClassName="text-[var(--battle-city-muted)]"
              value={reserveLives}
              valueTestId="battle-city-lives"
            />
            <GameStatCard
              className="border-[var(--battle-city-border)]"
              label="Waiting"
              labelClassName="text-[var(--battle-city-muted)]"
              value={enemiesRemaining}
              valueTestId="battle-city-enemies-remaining"
            />
          </GameStatsBar>
        </GameSidebar>

        <GameBoardStage
          actions={
            <GameBoardActions
              backDisabled={isHelpVisible}
              helpDisabled={isHelpVisible}
              onBackToMenu={requestBackToMenu}
              onHelp={openHelp}
              onRestart={restartGame}
              pauseAction={{
                disabled: isHelpVisible || !canPauseGame,
                isResume: game.status === "paused",
                label: pauseActionLabel,
                onClick: toggleRunState,
              }}
              restartDisabled={showStartScreen || pendingLeaderboardEntry !== null}
              testIdPrefix="battle-city"
            />
          }
        >
          <BattleCityBoard game={game}>
            {showStartScreen ? (
              <GameStartScreen testId="battle-city-start-screen">
                <GameStartScreenHeader
                  preview={<BattleCityStartPreview />}
                  status="Defend the phoenix through the classic 70-stage cycle"
                  title={BATTLE_CITY_DISPLAY_NAME}
                />
                <div
                  aria-label="Stage select"
                  className="flex items-center gap-2"
                  role="group"
                >
                  <Button
                    aria-label="Previous stage"
                    data-testid="battle-city-previous-stage-button"
                    onClick={() => selectReadyStage(-1)}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <ArrowLeftIcon aria-hidden="true" />
                  </Button>
                  <span
                    className="min-w-28 text-center text-lg font-semibold tabular-nums"
                    data-testid="battle-city-stage-select-value"
                  >
                    STAGE {game.stage}
                  </span>
                  <Button
                    aria-label="Next stage"
                    data-testid="battle-city-next-stage-button"
                    onClick={() => selectReadyStage(1)}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <ArrowRightIcon aria-hidden="true" />
                  </Button>
                </div>
                <Button
                  className="min-w-32"
                  data-testid="battle-city-start-button"
                  onClick={enterGame}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <PlayIcon data-icon="inline-start" />
                  Start
                </Button>
                <GameLeaderboardPanel {...leaderboardPanelProps} />
              </GameStartScreen>
            ) : showEndScreen ? (
              <GameEndScreen testId="battle-city-end-screen">
                <GameEndLeaderboardContent
                  action={
                    <Button
                      className="w-full max-w-xs"
                      data-testid="battle-city-new-game-button"
                      onClick={showNewCampaignSelector}
                      size="lg"
                      type="button"
                      variant="secondary"
                    >
                      <RotateCcwIcon data-icon="inline-start" />
                      New game
                    </Button>
                  }
                  leaderboard={finalLeaderboardProps}
                  pendingLeaderboardEntry={pendingLeaderboardEntry}
                  scoreForm={scoreFormProps}
                  summary={{
                    metricLabel: `Reached Stage ${stageLabel}`,
                    metricValue: game.score.toLocaleString("en-US"),
                    metricValueTestId: "battle-city-final-score",
                    title: game.baseAlive ? "Out of tanks" : "Headquarters destroyed",
                  }}
                />
              </GameEndScreen>
            ) : game.status === "paused" ? (
              <BattleCityStatusOverlay
                actionLabel="Resume"
                onAction={toggleRunState}
                testId="battle-city-board-state"
                title="Paused"
              />
            ) : game.status === "stage-results" ? (
              <BattleCityStageResults
                killCounts={stageResultDisplay.killCounts}
                score={game.score}
                showTotal={stageResultDisplay.showTotal}
                stage={Number(stageLabel)}
              />
            ) : game.status === "stage-intro" ? (
              <BattleCityStatusOverlay
                testId="battle-city-stage-intro"
                title={`STAGE ${stageLabel}`}
              />
            ) : game.status === "game-over" ? (
              <BattleCityStatusOverlay
                testId="battle-city-game-over"
                title="GAME OVER"
              />
            ) : null}
          </BattleCityBoard>
        </GameBoardStage>
      </GameBoardColumn>

      {isHelpVisible ? (
        <GameHelpScreen
          onClose={closeHelp}
          sections={BATTLE_CITY_HELP_SECTIONS}
          testId="battle-city-help-screen"
          title={BATTLE_CITY_DISPLAY_NAME}
        />
      ) : null}
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}

function BattleCityStartPreview() {
  return (
    <div
      aria-hidden="true"
      className="relative size-24 overflow-hidden rounded-md border border-[var(--battle-city-board-border)] bg-[var(--battle-city-board)] shadow-[0_0_22px_color-mix(in_oklch,var(--battle-city-player)_18%,transparent)]"
    >
      <span
        className="absolute bottom-2 left-2 size-10 bg-contain bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${getBattleCityAssetUrl(
            BATTLE_CITY_PLAYER_ASSET_BY_POWER_TIER[0],
          )})`,
        }}
      />
      <span
        className="absolute right-2 top-2 size-10 rotate-180 bg-contain bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${getBattleCityAssetUrl(
            "tank-enemy-armor.png",
          )})`,
        }}
      />
      <span
        className="absolute bottom-2 right-2 size-8 bg-contain bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${getBattleCityAssetUrl(
            "headquarters-intact.png",
          )})`,
        }}
      />
    </div>
  );
}

function BattleCityStatusOverlay({
  actionLabel,
  onAction,
  testId,
  title,
}: {
  actionLabel?: string;
  onAction?: () => void;
  testId: string;
  title: string;
}) {
  return (
    <div
      className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--battle-city-board)_78%,transparent)] text-center text-[var(--battle-city-board-text)] backdrop-blur-[2px]"
      data-testid={testId}
    >
      <div className="flex flex-col items-center gap-3">
        <p className="text-2xl font-semibold tracking-normal">{title}</p>
        {actionLabel && onAction ? (
          <Button onClick={onAction} size="lg" type="button" variant="secondary">
            <PlayIcon data-icon="inline-start" />
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
