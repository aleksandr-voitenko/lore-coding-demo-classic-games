"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AsteroidsBoard } from "@/components/asteroids-board";
import {
  createAsteroidsControlState,
  getAsteroidsControlInput,
  getAsteroidsControlKey,
  pressAsteroidsControlKey,
  releaseAsteroidsControlKey,
  resetAsteroidsControlState,
} from "@/components/asteroids-player-input";
import {
  isGamePauseKey,
  registerGameKeyDown,
  registerGameKeyUp,
  shouldIgnoreGameKeyDown,
} from "@/components/game-input";
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
import { Button } from "@/components/ui/button";
import { useGameLeaderboard } from "@/hooks/use-game-leaderboard";
import { useGameSession } from "@/hooks/use-game-session";
import {
  advanceAsteroidsGame,
  ASTEROIDS_STARTING_LIVES,
  createInitialAsteroidsGame,
  fireAsteroidsBullet,
  getAsteroidsTickDelay,
  pauseAsteroidsGame,
  restartAsteroidsGame,
  startAsteroidsGame,
  type AsteroidsGameState,
  type AsteroidsStatus,
} from "@/lib/asteroids-game-engine";
import { createGameLeaderboardKey } from "@/lib/leaderboard";

type AsteroidsGameProps = {
  initialAsteroidCount?: number;
  initialBoardHeight?: number;
  initialBoardWidth?: number;
  onBackToMenu?: () => void;
};

const statusLabels: Record<AsteroidsStatus, string> = {
  lost: "Game over",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
};

const ASTEROIDS_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [{ text: "Enter", label: "Enter key" }],
        label: "Start game",
      },
      {
        buttons: [{ icon: ArrowLeftIcon, label: "Left" }, { text: "A", label: "A key" }],
        label: "Hold to rotate counterclockwise",
      },
      {
        buttons: [{ icon: ArrowRightIcon, label: "Right" }, { text: "D", label: "D key" }],
        label: "Hold to rotate clockwise",
      },
      {
        buttons: [{ icon: ArrowUpIcon, label: "Up" }, { text: "W", label: "W key" }],
        label: "Hold to thrust",
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
      "Break large asteroids into medium rocks, then small rocks, then clear them.",
      "Wrap around the edges of the field to stay alive and line up shots.",
      "Clearing a wave spawns a denser field; the run ends when all lives are lost.",
    ],
  },
];

export function AsteroidsGame({
  initialAsteroidCount,
  initialBoardHeight,
  initialBoardWidth,
  onBackToMenu,
}: AsteroidsGameProps = {}) {
  const [controlState] = useState(() => createAsteroidsControlState());
  const [game, setGame] = useState<AsteroidsGameState>(() =>
    createInitialAsteroidsGame({
      asteroidCount: initialAsteroidCount,
      boardHeight: initialBoardHeight,
      boardWidth: initialBoardWidth,
    }),
  );
  const tickDelay = game.status === "running" ? getAsteroidsTickDelay() : null;
  const canPauseGame = game.status === "running" || game.status === "paused";
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const showStartScreen = game.status === "ready";
  const showEndScreen = game.status === "lost";
  const showPauseScreen = game.status === "paused";
  const leaderboardKey = createGameLeaderboardKey("asteroids", [
    { name: "board", value: `${game.boardWidth}x${game.boardHeight}` },
    { name: "rocks", value: game.startingAsteroidCount },
  ]);
  const isAsteroidsStarted =
    game.status !== "ready" ||
    game.score > 0 ||
    game.wave > 1 ||
    game.lives < ASTEROIDS_STARTING_LIVES;
  const { completedSessionId } = useGameSession({
    active: game.status === "running",
    finalResult: game.status === "lost" ? "lost" : null,
    finalScore: game.score,
    gameId: "asteroids",
    leaderboardKey,
    started: isAsteroidsStarted,
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

  const resetControls = useCallback(() => {
    resetAsteroidsControlState(controlState);
  }, [controlState]);

  const startGame = useCallback(() => {
    resetControls();
    resetLeaderboardForm();
    setGame((current) => startAsteroidsGame(current));
  }, [resetControls, resetLeaderboardForm]);

  const toggleRunState = useCallback(() => {
    resetControls();
    resetLeaderboardForm();
    setGame((current) => {
      if (current.status === "running") {
        return pauseAsteroidsGame(current);
      }

      return startAsteroidsGame(current);
    });
  }, [resetControls, resetLeaderboardForm]);

  const restartGame = useCallback(() => {
    resetControls();
    resetLeaderboardForm();
    setGame((current) => restartAsteroidsGame(current));
  }, [resetControls, resetLeaderboardForm]);

  const fireBullet = useCallback(() => {
    setGame((current) => fireAsteroidsBullet(current));
  }, []);

  const advanceAsteroids = useCallback(() => {
    setGame((current) => advanceAsteroidsGame(current, getAsteroidsControlInput(controlState)));
  }, [controlState]);

  const saveLeaderboardScore = useCallback(() => {
    void savePendingLeaderboardScore();
  }, [savePendingLeaderboardScore]);

  const pauseGameForHelp = useCallback(() => {
    resetControls();
    setGame((current) => pauseAsteroidsGame(current));
  }, [resetControls]);

  const resumeGameAfterHelp = useCallback(() => {
    setGame((current) => startAsteroidsGame(current));
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

  useEffect(() => {
    if (tickDelay === null) {
      return;
    }

    const tick = window.setInterval(advanceAsteroids, tickDelay);

    return () => window.clearInterval(tick);
  }, [advanceAsteroids, tickDelay]);

  useEffect(() => {
    if (isHelpVisible || pendingLeaderboardEntry !== null || game.status !== "running") {
      resetControls();
    }
  }, [game.status, isHelpVisible, pendingLeaderboardEntry, resetControls]);

  useEffect(() => {
    window.addEventListener("blur", resetControls);

    return () => {
      window.removeEventListener("blur", resetControls);
      resetControls();
    };
  }, [resetControls]);

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

      if (event.key === " ") {
        event.preventDefault();

        if (game.status === "running") {
          fireBullet();
        }

        return;
      }

      const controlKey = getAsteroidsControlKey(event.key);

      if (controlKey !== null) {
        event.preventDefault();

        if (game.status === "running") {
          pressAsteroidsControlKey(controlState, controlKey);
        }
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const controlKey = getAsteroidsControlKey(event.key);

      if (controlKey === null) {
        return;
      }

      if (releaseAsteroidsControlKey(controlState, controlKey)) {
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
    controlState,
    fireBullet,
    game.status,
    isHelpVisible,
    pendingLeaderboardEntry,
    startGame,
    toggleRunState,
  ]);

  return (
    <GameShell className="bg-[var(--asteroids-page)] text-[var(--asteroids-ink)]">
      <GameBoardColumn className="w-[min(94vw,50rem,calc(133.333svh_-_16rem))]">
        <GameSidebar className="border-[var(--asteroids-border)] bg-[var(--asteroids-panel)]">
          <GameHeader
            status={statusLabels[game.status]}
            statusTestId="asteroids-status"
            title="Classic Asteroids"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--asteroids-border)]"
              label="Score"
              labelClassName="text-[var(--asteroids-muted)]"
              value={game.score}
              valueTestId="asteroids-score"
            />
            <GameStatCard
              className="border-[var(--asteroids-border)]"
              label="Lives"
              labelClassName="text-[var(--asteroids-muted)]"
              value={game.lives}
              valueTestId="asteroids-lives"
            />
            <GameStatCard
              className="border-[var(--asteroids-border)]"
              label="Wave"
              labelClassName="text-[var(--asteroids-muted)]"
              value={game.wave}
              valueTestId="asteroids-wave"
            />
            <GameStatCard
              className="border-[var(--asteroids-border)]"
              label="Rocks"
              labelClassName="text-[var(--asteroids-muted)]"
              value={game.asteroids.length}
              valueTestId="asteroids-rocks"
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
              testIdPrefix="asteroids"
            />
          }
        >
          <AsteroidsBoard game={game} statusLabel={statusLabels[game.status]}>
            {showStartScreen ? (
              <div
                className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[color-mix(in_oklch,var(--asteroids-board)_92%,black)] px-4 py-5 text-center text-[var(--asteroids-board-text)]"
                data-testid="asteroids-start-screen"
              >
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="grid h-16 w-28 place-items-center rounded-md border border-[color-mix(in_oklch,var(--asteroids-ship)_48%,transparent)] bg-[color-mix(in_oklch,var(--asteroids-ship)_8%,transparent)] text-[var(--asteroids-ship)] shadow-[0_0_22px_color-mix(in_oklch,var(--asteroids-ship)_22%,transparent)]"
                    aria-hidden="true"
                  >
                    <svg className="h-11 w-16" viewBox="0 0 64 44">
                      <polygon
                        fill="none"
                        points="32,3 12,40 32,29 52,40"
                        stroke="currentColor"
                        strokeLinejoin="round"
                        strokeWidth="3"
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-3xl font-semibold tracking-normal text-balance">
                      Classic Asteroids
                    </p>
                    <p className="text-sm font-medium text-[color-mix(in_oklch,var(--asteroids-board-text)_74%,transparent)]">
                      {game.startingAsteroidCount} rocks. Endless waves.
                    </p>
                  </div>
                </div>
                <Button
                  className="min-w-32"
                  data-testid="asteroids-start-button"
                  onClick={startGame}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <PlayIcon data-icon="inline-start" />
                  Start
                </Button>
                <GameLeaderboardPanel
                  slotTestIdPrefix="asteroids-leaderboard-slot"
                  slots={leaderboardSlots}
                  statusMessage={leaderboardStatusMessage}
                  testId="asteroids-start-leaderboard"
                />
              </div>
            ) : showEndScreen ? (
              <GameEndScreen testId="asteroids-end-screen">
                <GameEndLeaderboardContent
                  action={
                    <Button
                      className="min-w-36"
                      data-testid="asteroids-new-game-button"
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
                    slotTestIdPrefix: "asteroids-final-leaderboard-slot",
                    slots: leaderboardSlots,
                    statusMessage: leaderboardStatusMessage,
                    testId: "asteroids-final-leaderboard",
                  }}
                  pendingLeaderboardEntry={pendingLeaderboardEntry}
                  scoreForm={{
                    isSaving: isSavingLeaderboardScore,
                    onPlayerNameChange: setPlayerName,
                    onSaveScore: saveLeaderboardScore,
                    playerName,
                    saveFailed: scoreSaveFailed,
                    testIdPrefix: "asteroids",
                  }}
                  summary={{
                    metricLabel: "Final score",
                    metricValue: game.score,
                    metricValueTestId: "asteroids-final-score",
                    title: "Game over",
                  }}
                />
              </GameEndScreen>
            ) : showPauseScreen ? (
              <div
                className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--asteroids-board)_74%,transparent)] text-center text-[var(--asteroids-board-text)] backdrop-blur-[2px]"
                data-testid="asteroids-board-state"
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
                className="border-[color-mix(in_oklch,var(--asteroids-board-text)_24%,transparent)] bg-[color-mix(in_oklch,var(--asteroids-board)_94%,black)] text-[var(--asteroids-board-text)]"
                onClose={closeHelp}
                sections={ASTEROIDS_HELP_SECTIONS}
                testId="asteroids-help-screen"
                title="Classic Asteroids"
              />
            ) : null}
          </AsteroidsBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}
