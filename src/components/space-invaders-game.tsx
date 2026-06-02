"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
  GameStatsBar,
  GameStatCard,
  useGameEscapeToMenu,
  useGameHelpScreen,
  type GameHelpSection,
} from "@/components/game-layout";
import { GameLeaderboardPanel } from "@/components/game-leaderboard";
import {
  isGamePauseKey,
  registerGameKeyDown,
  registerGameKeyUp,
  shouldIgnoreGameKeyDown,
  useHeldDirectionMovementController,
} from "@/components/game-input";
import {
  getSpaceInvadersPowerUpSpriteSrc,
  getSpaceInvaderSprite,
  SpaceInvadersBoard,
} from "@/components/space-invaders-board";
import {
  createSpaceInvadersPlayerMovementState,
  getSpaceInvadersPlayerMovementKey,
  type SpaceInvadersPlayerMovementDirection,
} from "@/components/space-invaders-player-input";
import { Button } from "@/components/ui/button";
import {
  advanceSpaceInvadersGame,
  createInitialSpaceInvadersGame,
  fireSpaceInvadersShot,
  getSpaceInvadersTickDelay,
  moveSpaceInvadersPlayerLeft,
  moveSpaceInvadersPlayerRight,
  pauseSpaceInvadersGame,
  restartSpaceInvadersGame,
  SPACE_INVADERS_BONUS_SCORE_POINTS,
  SPACE_INVADERS_HIT_STREAK_BONUS_CAP,
  SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
  SPACE_INVADERS_MULTI_KILL_BONUSES,
  SPACE_INVADERS_UFO_CHAIN_BONUS_CAP,
  SPACE_INVADERS_UFO_CHAIN_BONUS_STEP,
  startSpaceInvadersGame,
  type SpaceInvadersGameState,
  type SpaceInvadersPowerUpKind,
  type SpaceInvadersStatus,
} from "@/lib/space-invaders-game-engine";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";
import { useGameLeaderboard } from "@/hooks/use-game-leaderboard";
import { useGameSession } from "@/hooks/use-game-session";

type SpaceInvadersGameProps = {
  initialAlienCount?: number;
  initialBoardHeight?: number;
  initialBoardWidth?: number;
  onBackToMenu?: () => void;
};

const statusLabels: Record<SpaceInvadersStatus, string> = {
  lost: "Game over",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
  won: "Earth defended",
};

const powerUpLabels: Record<SpaceInvadersPowerUpKind, string> = {
  "bonus-score": "Bonus score",
  "burst-shot": "Burst",
  "extra-life": "Extra life",
  freeze: "Freeze",
  "piercing-laser": "Piercing",
  shield: "Shield",
  "shotgun-shot": "Shotgun",
};

export function getSpaceInvadersActivePowerUpKind(
  game: SpaceInvadersGameState,
): SpaceInvadersPowerUpKind | null {
  if (game.pendingShotPowerUp !== null) {
    return game.pendingShotPowerUp;
  }

  if (game.alienFreezeTicks > 0) {
    return "freeze";
  }

  if (game.playerShieldTicks > 0) {
    return "shield";
  }

  return null;
}

function SpaceInvadersPowerStatusIcon({
  kind,
}: {
  kind: SpaceInvadersPowerUpKind | null;
}) {
  if (kind === null) {
    return (
      <span
        aria-label="No active power"
        className="block size-8"
        data-power-up-kind="none"
        role="img"
      />
    );
  }

  return (
    <span
      aria-label={powerUpLabels[kind]}
      className="block size-8 bg-contain bg-center bg-no-repeat drop-shadow-[0_0_8px_rgb(255_255_255_/_0.38)] [image-rendering:pixelated]"
      data-power-up-kind={kind}
      role="img"
      style={{ backgroundImage: `url("${getSpaceInvadersPowerUpSpriteSrc(kind)}")` }}
      title={powerUpLabels[kind]}
    />
  );
}

export const SPACE_INVADERS_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [{ text: "Enter", label: "Enter key" }],
        label: "Start game",
      },
      {
        buttons: [{ icon: ArrowLeftIcon, label: "Left" }, { text: "A", label: "A key" }],
        label: "Hold to move cannon left",
      },
      {
        buttons: [{ icon: ArrowRightIcon, label: "Right" }, { text: "D", label: "D key" }],
        label: "Hold to move cannon right",
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
      "Shoot every invader before the formation reaches your base.",
      "Only one normal shot or one primed shot sequence can be active at a time.",
      "Shoot the UFO bonus ship when it crosses the sky for extra points.",
      `Clean hit streaks add ${SPACE_INVADERS_HIT_STREAK_BONUS_STEP} more points per hit after the first, up to ${SPACE_INVADERS_HIT_STREAK_BONUS_CAP}; missed shots and player hits reset the streak.`,
      `Destroying multiple invaders in one volley adds ${SPACE_INVADERS_MULTI_KILL_BONUSES[2]}, ${SPACE_INVADERS_MULTI_KILL_BONUSES[3]}, or ${SPACE_INVADERS_MULTI_KILL_BONUSES[4]} bonus points.`,
      `Consecutive UFO hits add ${SPACE_INVADERS_UFO_CHAIN_BONUS_STEP} more points per UFO after the first, up to ${SPACE_INVADERS_UFO_CHAIN_BONUS_CAP}; escaped UFOs reset the chain.`,
      "Clear columns carefully; exposed diver invaders move faster and drop harder than the rest.",
      `Destroyed diver invaders drop power-up icons: bonus score adds ${SPACE_INVADERS_BONUS_SCORE_POINTS} points, extra life rarely grants a life, Burst, Freeze, Piercing, Shield, and Shotgun grant their matching bonuses.`,
      "Burst, Piercing, and Shotgun change your next shot, then return the cannon to its normal laser.",
      "Each exposed invader row fires its own pattern: tracking bolts, delayed bursts, scatter bursts, needles, or lasers.",
      "After a hit, your cannon returns when the explosion finishes and stays shielded for a short window.",
      "Defend Earth to win; the game ends if you lose every life or the invaders reach the base.",
    ],
  },
];

const SPACE_INVADERS_PLAYER_MOVE_INTERVAL_MS = getSpaceInvadersTickDelay();

export function SpaceInvadersGame({
  initialAlienCount,
  initialBoardHeight,
  initialBoardWidth,
  onBackToMenu,
}: SpaceInvadersGameProps = {}) {
  const [game, setGame] = useState<SpaceInvadersGameState>(() =>
    createInitialSpaceInvadersGame({
      alienCount: initialAlienCount,
      boardHeight: initialBoardHeight,
      boardWidth: initialBoardWidth,
    }),
  );
  const tickDelay = game.status === "running" ? getSpaceInvadersTickDelay() : null;
  const activeInvaderCount = game.invaders.filter((invader) => invader.isActive).length;
  const canPauseGame = game.status === "running" || game.status === "paused";
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const showStartScreen = game.status === "ready";
  const showEndScreen = game.status === "lost" || game.status === "won";
  const showPauseScreen = game.status === "paused";
  const leaderboardKey = createGameLeaderboardKey("space-invaders", [
    { name: "board", value: `${game.boardWidth}x${game.boardHeight}` },
    { name: "aliens", value: game.alienCount },
  ]);
  const { completedSessionId } = useGameSession({
    active: game.status === "running",
    finalResult:
      game.status === "lost" || game.status === "won" ? game.status : null,
    finalScore: game.score,
    gameId: "space-invaders",
    leaderboardKey,
    started: game.status !== "ready",
  });
  const {
    isSavingLeaderboardScore,
    leaderboardSlots,
    leaderboardStatusMessage,
    pendingLeaderboardEntry,
    playerName,
    resetLeaderboardForm,
    saveLeaderboardScore: savePendingLeaderboardScore,
    scoreSaveFailed,
    setPlayerName,
  } = useGameLeaderboard({
    gameSessionId: completedSessionId,
    leaderboardKey,
    pendingScore: showEndScreen ? game.score : null,
  });

  const startGame = useCallback(() => {
    resetLeaderboardForm();
    setGame((current) => startSpaceInvadersGame(current));
  }, [resetLeaderboardForm]);

  const toggleRunState = useCallback(() => {
    resetLeaderboardForm();
    setGame((current) => {
      if (current.status === "running") {
        return pauseSpaceInvadersGame(current);
      }

      return startSpaceInvadersGame(current);
    });
  }, [resetLeaderboardForm]);

  const restartGame = useCallback(() => {
    resetLeaderboardForm();
    setGame((current) => restartSpaceInvadersGame(current));
  }, [resetLeaderboardForm]);

  const movePlayer = useCallback((direction: SpaceInvadersPlayerMovementDirection) => {
    setGame((current) =>
      direction === "left"
        ? moveSpaceInvadersPlayerLeft(current)
        : moveSpaceInvadersPlayerRight(current),
    );
  }, []);

  const fireShot = useCallback(() => {
    setGame((current) => fireSpaceInvadersShot(current));
  }, []);

  const advanceSpaceInvaders = useCallback(() => {
    setGame((current) => advanceSpaceInvadersGame(current));
  }, []);

  const saveLeaderboardScore = useCallback(() => {
    void savePendingLeaderboardScore();
  }, [savePendingLeaderboardScore]);

  const pauseGameForHelp = useCallback(() => {
    setGame((current) => pauseSpaceInvadersGame(current));
  }, []);

  const resumeGameAfterHelp = useCallback(() => {
    setGame((current) => startSpaceInvadersGame(current));
  }, []);

  const { closeHelp, isHelpVisible, openHelp } = useGameHelpScreen({
    isGameActive: game.status === "running",
    onPauseGame: pauseGameForHelp,
    onResumeGame: resumeGameAfterHelp,
  });
  const { abandonDialogProps, requestBackToMenu } = useGameEscapeToMenu({
    isDisabled: isHelpVisible,
    isGameStarted: canPauseGame,
    onBackToMenu,
    onPauseGame: pauseGameForHelp,
    onResumeGame: resumeGameAfterHelp,
    shouldPauseBeforeConfirm: canPauseGame,
  });

  const {
    beginMovement: beginPlayerMovement,
    endMovement: endPlayerMovement,
  } = useHeldDirectionMovementController({
    createState: createSpaceInvadersPlayerMovementState,
    intervalMs: SPACE_INVADERS_PLAYER_MOVE_INTERVAL_MS,
    isMovementDisabled:
      isHelpVisible || pendingLeaderboardEntry !== null || game.status !== "running",
    move: movePlayer,
  });

  useEffect(() => {
    if (tickDelay === null) {
      return;
    }

    const tick = window.setInterval(advanceSpaceInvaders, tickDelay);

    return () => window.clearInterval(tick);
  }, [advanceSpaceInvaders, tickDelay]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        shouldIgnoreGameKeyDown(event, {
          hasPendingLeaderboardEntry: pendingLeaderboardEntry !== null,
          isHelpVisible,
        })
      ) {
        return;
      }

      if (event.key === "Enter" && game.status !== "running" && game.status !== "paused") {
        event.preventDefault();
        startGame();
        return;
      }

      if (isGamePauseKey(event.key)) {
        event.preventDefault();
        toggleRunState();
        return;
      }

      if (game.status !== "running") {
        return;
      }

      const movementKey = getSpaceInvadersPlayerMovementKey(event.key);

      if (movementKey !== null) {
        event.preventDefault();
        beginPlayerMovement(movementKey);
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        fireShot();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const movementKey = getSpaceInvadersPlayerMovementKey(event.key);

      if (movementKey === null) {
        return;
      }

      if (endPlayerMovement(movementKey)) {
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
    beginPlayerMovement,
    endPlayerMovement,
    fireShot,
    game.status,
    isHelpVisible,
    pendingLeaderboardEntry,
    startGame,
    toggleRunState,
  ]);

  return (
    <GameShell className="bg-[var(--invaders-page)] text-[var(--invaders-ink)]">
      <GameBoardColumn className="w-[min(92vw,37.25rem,calc(75svh_-_9rem))]">
        <GameSidebar className="border-[var(--invaders-border)] bg-[var(--invaders-panel)]">
          <GameHeader
            status={statusLabels[game.status]}
            statusTestId="space-invaders-status"
            title="Classic Space Invaders"
          />

          <GameStatsBar className="grid-flow-row grid-cols-4 sm:grid-cols-7">
            <GameStatCard
              className="border-[var(--invaders-border)]"
              label="Score"
              labelClassName="text-[var(--invaders-muted)]"
              value={game.score}
              valueTestId="space-invaders-score"
            />
            <GameStatCard
              className="border-[var(--invaders-border)]"
              label="Lives"
              labelClassName="text-[var(--invaders-muted)]"
              value={game.lives}
              valueTestId="space-invaders-lives"
            />
            <GameStatCard
              className="border-[var(--invaders-border)]"
              label="Invaders"
              labelClassName="text-[var(--invaders-muted)]"
              value={activeInvaderCount}
              valueTestId="space-invaders-remaining"
            />
            <GameStatCard
              className="border-[var(--invaders-border)]"
              label="Streak"
              labelClassName="text-[var(--invaders-muted)]"
              value={game.hitStreak}
              valueTestId="space-invaders-hit-streak"
            />
            <GameStatCard
              className="border-[var(--invaders-border)]"
              label="UFO"
              labelClassName="text-[var(--invaders-muted)]"
              value={game.ufoHitStreak}
              valueTestId="space-invaders-ufo-chain"
            />
            <GameStatCard
              className="border-[var(--invaders-border)]"
              label="Speed"
              labelClassName="text-[var(--invaders-muted)]"
              value={tickDelay === null ? "0" : Math.round(1000 / tickDelay)}
              valueTestId="space-invaders-speed"
            />
            <GameStatCard
              className="border-[var(--invaders-border)]"
              label="Power"
              labelClassName="text-[var(--invaders-muted)]"
              value={
                <SpaceInvadersPowerStatusIcon
                  kind={getSpaceInvadersActivePowerUpKind(game)}
                />
              }
              valueClassName="flex h-8 items-center"
              valueTestId="space-invaders-power"
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
              restartDisabled={game.status === "ready" || pendingLeaderboardEntry !== null}
              testIdPrefix="space-invaders"
            />
          }
        >
          <SpaceInvadersBoard game={game} statusLabel={statusLabels[game.status]}>
          {showStartScreen ? (
            <div
              className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[var(--invaders-board)] px-4 py-5 text-center text-[var(--invaders-board-text)]"
              data-testid="space-invaders-start-screen"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="grid grid-cols-6 gap-1" aria-hidden="true">
                  {Array.from({ length: 24 }, (_, index) => {
                    const sprite = getSpaceInvaderSprite(Math.floor(index / 6));

                    return (
                      <span
                        className={cn(
                          "h-4 w-6 bg-contain bg-center bg-no-repeat [image-rendering:pixelated]",
                          sprite.glowClassName,
                        )}
                        key={index}
                        style={{ backgroundImage: `url("${sprite.src}")` }}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-3xl font-semibold tracking-normal text-balance">
                    Classic Space Invaders
                  </p>
                  <p className="text-sm font-medium text-[color-mix(in_oklch,var(--invaders-board-text)_74%,transparent)]">
                    {statusLabels[game.status]}
                  </p>
                </div>
              </div>
              <Button
                className="min-w-32"
                data-testid="space-invaders-start-button"
                onClick={startGame}
                size="lg"
                type="button"
                variant="secondary"
              >
                <PlayIcon data-icon="inline-start" />
                Start
              </Button>
              <GameLeaderboardPanel
                slotTestIdPrefix="space-invaders-leaderboard-slot"
                slots={leaderboardSlots}
                statusMessage={leaderboardStatusMessage}
                testId="space-invaders-start-leaderboard"
              />
            </div>
          ) : showEndScreen ? (
            <GameEndScreen testId="space-invaders-end-screen">
              <GameEndLeaderboardContent
                action={
                  <Button
                    className="min-w-36"
                    data-testid="space-invaders-new-game-button"
                    onClick={restartGame}
                    size="lg"
                    type="button"
                    variant="secondary"
                  >
                    <RotateCcwIcon data-icon="inline-start" />
                    New game
                  </Button>
                }
                leaderboard={{
                  slotTestIdPrefix: "space-invaders-final-leaderboard-slot",
                  slots: leaderboardSlots,
                  statusMessage: leaderboardStatusMessage,
                  testId: "space-invaders-final-leaderboard",
                }}
                pendingLeaderboardEntry={pendingLeaderboardEntry}
                scoreForm={{
                  isSaving: isSavingLeaderboardScore,
                  onPlayerNameChange: setPlayerName,
                  onSaveScore: saveLeaderboardScore,
                  playerName,
                  saveFailed: scoreSaveFailed,
                  testIdPrefix: "space-invaders",
                }}
                summary={{
                  metricLabel: "Final score",
                  metricValue: game.score,
                  metricValueTestId: "space-invaders-final-score",
                  title: game.status === "won" ? "Earth defended" : "Game over",
                }}
              />
            </GameEndScreen>
          ) : showPauseScreen ? (
            <div
              className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--invaders-board)_72%,transparent)] text-center text-[var(--invaders-board-text)] backdrop-blur-[2px]"
              data-testid="space-invaders-board-state"
            >
              <div className="flex flex-col items-center gap-3">
                <p className="text-2xl font-semibold tracking-normal">Paused</p>
                <Button
                  className="min-w-32"
                  onClick={toggleRunState}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <PlayIcon data-icon="inline-start" />
                  Resume
                </Button>
              </div>
            </div>
          ) : null}
          {isHelpVisible ? (
            <GameHelpScreen
              className="border-[color-mix(in_oklch,var(--invaders-board-text)_24%,transparent)] bg-[color-mix(in_oklch,var(--invaders-board)_94%,black)] text-[var(--invaders-board-text)]"
              onClose={closeHelp}
              sections={SPACE_INVADERS_HELP_SECTIONS}
              testId="space-invaders-help-screen"
              title="Classic Space Invaders"
            />
          ) : null}
          </SpaceInvadersBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}
