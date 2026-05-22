"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  GameAbandonDialog,
  GameBoardActions,
  GameBoardColumn,
  GameBoardStage,
  GameHeader,
  GameHelpScreen,
  GameShell,
  GameSidebar,
  useGameEscapeToMenu,
  useGameHelpScreen,
  type GameHelpSection,
} from "@/components/game-layout";
import { GameLeaderboardPanel, GameLeaderboardScoreForm } from "@/components/game-leaderboard";
import { isTypingTarget } from "@/components/game-input";
import { SnakeBoard } from "@/components/snake-board";
import { Button } from "@/components/ui/button";
import {
  advanceSnakeGame,
  createInitialGame,
  expireTimedFood,
  getGameTickDelay,
  getTimedFoodSpawnDelay,
  queueGameDirection,
  spawnTimedFood,
  type Direction,
  type GameState,
  type GameStatus,
  type TimedFoodKind,
} from "@/lib/snake-game-engine";
import { createFoodFeedback, type FoodFeedback } from "@/lib/snake-food-feedback";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";
import { useGameLeaderboard } from "@/hooks/use-game-leaderboard";

type TimedFoodLifecycleOptions = {
  gameStatus: GameStatus;
  kind: TimedFoodKind;
  setGame: Dispatch<SetStateAction<GameState>>;
  timedFood: GameState[TimedFoodKind];
};

type SnakeGameProps = {
  initialBoardSize?: number;
  onBackToMenu?: () => void;
};

const START_SCREEN_CELLS = Array.from({ length: 15 }, (_, index) => ({
  index,
  isSnake: [2, 7, 8, 9, 14].includes(index),
}));

const keyDirections: Record<string, Direction> = {
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowRight: "right",
  d: "right",
  D: "right",
  ArrowDown: "down",
  s: "down",
  S: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left",
};

const statusLabels: Record<GameStatus, string> = {
  ready: "Ready",
  running: "Running",
  paused: "Paused",
  lost: "Game over",
  won: "You won",
};

const SNAKE_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [{ text: "Space", label: "Space key" }],
        label: "Start game",
      },
      {
        buttons: [{ text: "Space", label: "Space key" }],
        label: "Pause or resume",
      },
      {
        buttons: [{ icon: ArrowUpIcon, label: "Up" }, { text: "W", label: "W key" }],
        label: "Move up",
      },
      {
        buttons: [{ icon: ArrowLeftIcon, label: "Left" }, { text: "A", label: "A key" }],
        label: "Move left",
      },
      {
        buttons: [{ icon: ArrowDownIcon, label: "Down" }, { text: "S", label: "S key" }],
        label: "Move down",
      },
      {
        buttons: [{ icon: ArrowRightIcon, label: "Right" }, { text: "D", label: "D key" }],
        label: "Move right",
      },
      {
        buttons: [{ text: "Enter", label: "Enter key" }],
        label: "Start a new game after finish",
      },
    ],
  },
  {
    title: "Rules",
    items: [
      "Eat red apples to grow and score.",
      "Special foods appear briefly and can change score, speed, or length.",
      "Avoid walls, obstacles, and your own body.",
      "Fill the board without crashing to win.",
    ],
  },
];

function useTimedFoodLifecycle({
  gameStatus,
  kind,
  setGame,
  timedFood,
}: TimedFoodLifecycleOptions) {
  useEffect(() => {
    if (gameStatus !== "running" || timedFood !== null) {
      return;
    }

    const spawn = window.setTimeout(() => {
      setGame((current) => spawnTimedFood(current, kind));
    }, getTimedFoodSpawnDelay(kind));

    return () => window.clearTimeout(spawn);
  }, [gameStatus, kind, setGame, timedFood]);

  const expiresAt = timedFood?.expiresAt ?? null;

  useEffect(() => {
    if (gameStatus !== "running" || expiresAt === null) {
      return;
    }

    const timeout = window.setTimeout(
      () => {
        setGame((current) => expireTimedFood(current, kind, expiresAt));
      },
      Math.max(0, expiresAt - Date.now()),
    );

    return () => window.clearTimeout(timeout);
  }, [expiresAt, gameStatus, kind, setGame]);
}

export function SnakeGame({ initialBoardSize, onBackToMenu }: SnakeGameProps = {}) {
  const [game, setGame] = useState<GameState>(() =>
    createInitialGame({ boardSize: initialBoardSize }),
  );
  const [foodFeedbacks, setFoodFeedbacks] = useState<FoodFeedback[]>([]);
  const foodFeedbackIdRef = useRef(0);
  const previousGameRef = useRef(game);
  const leaderboardKey = createGameLeaderboardKey("snake", [
    { name: "board", value: game.boardSize },
  ]);
  const pendingLeaderboardScore =
    game.status === "lost" || game.status === "won" ? game.score : null;
  const {
    isSavingLeaderboardScore,
    leaderboard,
    leaderboardBestScore,
    leaderboardSlots,
    leaderboardStatusMessage,
    pendingLeaderboardEntry,
    playerName,
    resetLeaderboardForm,
    saveLeaderboardScore: savePendingLeaderboardScore,
    scoreSaveFailed,
    setPlayerName,
  } = useGameLeaderboard({
    leaderboardKey,
    pendingScore: pendingLeaderboardScore,
  });
  const bestScore = Math.max(game.bestScore, leaderboardBestScore);
  const speed = getGameTickDelay({
    score: game.score,
    speedBoosts: game.speedBoosts,
    status: game.status,
  });
  const removeFoodFeedback = useCallback((id: number) => {
    setFoodFeedbacks((current) => current.filter((feedback) => feedback.id !== id));
  }, []);

  const queueDirection = useCallback((nextDirection: Direction) => {
    setGame((current) => queueGameDirection(current, nextDirection));
  }, []);

  const advanceSnake = useCallback(() => {
    setGame((current) =>
      advanceSnakeGame(current, {
        leaderboard,
        leaderboardBestScore,
      }),
    );
  }, [leaderboard, leaderboardBestScore]);

  const toggleRunState = useCallback(() => {
    resetLeaderboardForm();
    setGame((current) => {
      if (current.status === "running") {
        return { ...current, status: "paused" };
      }

      if (current.status === "paused") {
        return { ...current, status: "running" };
      }

      return {
        ...createInitialGame({
          bestScore: Math.max(current.bestScore, leaderboardBestScore),
          boardSize: current.boardSize,
          random: Math.random,
        }),
        status: "running",
      };
    });
  }, [leaderboardBestScore, resetLeaderboardForm]);

  const restartGame = useCallback(() => {
    resetLeaderboardForm();
    setFoodFeedbacks([]);
    setGame((current) => ({
      ...createInitialGame({
        bestScore: Math.max(current.bestScore, leaderboardBestScore),
        boardSize: current.boardSize,
        random: Math.random,
      }),
      status: "running",
    }));
  }, [leaderboardBestScore, resetLeaderboardForm]);

  const pauseGameForHelp = useCallback(() => {
    setGame((current) =>
      current.status === "running" ? { ...current, status: "paused" } : current,
    );
  }, []);

  const resumeGameAfterHelp = useCallback(() => {
    setGame((current) =>
      current.status === "paused" ? { ...current, status: "running" } : current,
    );
  }, []);

  const canPauseGame = game.status === "running" || game.status === "paused";
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

  const saveLeaderboardScore = useCallback(() => {
    void savePendingLeaderboardScore();
  }, [savePendingLeaderboardScore]);

  useEffect(() => {
    const previousGame = previousGameRef.current;
    previousGameRef.current = game;

    const feedback = createFoodFeedback(previousGame, game, foodFeedbackIdRef.current);

    if (feedback === null) {
      return;
    }

    foodFeedbackIdRef.current += 1;
    setFoodFeedbacks((current) => [...current, feedback].slice(-6));
  }, [game]);

  useTimedFoodLifecycle({
    gameStatus: game.status,
    kind: "bonusFood",
    setGame,
    timedFood: game.bonusFood,
  });
  useTimedFoodLifecycle({
    gameStatus: game.status,
    kind: "speedFood",
    setGame,
    timedFood: game.speedFood,
  });
  useTimedFoodLifecycle({
    gameStatus: game.status,
    kind: "slowFood",
    setGame,
    timedFood: game.slowFood,
  });
  useTimedFoodLifecycle({
    gameStatus: game.status,
    kind: "shrinkFood",
    setGame,
    timedFood: game.shrinkFood,
  });

  useEffect(() => {
    if (speed === null) {
      return;
    }

    const tick = window.setInterval(advanceSnake, speed);

    return () => window.clearInterval(tick);
  }, [advanceSnake, speed]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isHelpVisible) {
        return;
      }

      if (pendingLeaderboardEntry !== null || isTypingTarget(event.target)) {
        return;
      }

      const nextDirection = keyDirections[event.key];

      if (nextDirection) {
        event.preventDefault();
        queueDirection(nextDirection);
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        toggleRunState();
      }

      if (event.key === "Enter" && (game.status === "lost" || game.status === "won")) {
        event.preventDefault();
        restartGame();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    game.status,
    isHelpVisible,
    pendingLeaderboardEntry,
    queueDirection,
    restartGame,
    toggleRunState,
  ]);

  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const showStartScreen = game.status === "ready";
  const showGameOverScreen = game.status === "lost" || game.status === "won";
  const showBoardState = game.status !== "running";

  return (
    <GameShell className="bg-[var(--snake-page)] text-[var(--snake-ink)]">
      <GameSidebar className="border-[var(--snake-border)] bg-[var(--snake-panel)]">
        <GameHeader
          accentClassName="bg-[var(--snake-accent)]"
          status={statusLabels[game.status]}
          statusClassName="text-[var(--snake-muted)]"
          statusTestId="snake-status"
          title="Classic Snake"
        />

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-[var(--snake-border)] p-3">
              <dt className="text-xs font-medium text-[var(--snake-muted)]">
                Score
              </dt>
              <dd
                className="font-mono text-3xl font-semibold leading-none"
                data-testid="snake-score"
              >
                {game.score}
              </dd>
            </div>
            <div className="rounded-md border border-[var(--snake-border)] p-3">
              <dt className="text-xs font-medium text-[var(--snake-muted)]">
                Best
              </dt>
              <dd
                className="font-mono text-3xl font-semibold leading-none"
                data-testid="snake-best"
              >
                {bestScore}
              </dd>
            </div>
            <div className="rounded-md border border-[var(--snake-border)] p-3">
              <dt className="text-xs font-medium text-[var(--snake-muted)]">
                Length
              </dt>
              <dd
                className="font-mono text-3xl font-semibold leading-none"
                data-testid="snake-length"
              >
                {game.snake.length}
              </dd>
            </div>
            <div className="rounded-md border border-[var(--snake-border)] p-3">
              <dt className="text-xs font-medium text-[var(--snake-muted)]">
                Speed
              </dt>
              <dd
                className="font-mono text-3xl font-semibold leading-none"
                data-testid="snake-speed"
              >
                {speed === null ? "0" : `${Math.round(1000 / speed)}`}
              </dd>
            </div>
          </dl>

      </GameSidebar>

      <GameBoardColumn className="max-w-[min(92vw,41.25rem)]">
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
              testIdPrefix="snake"
            />
          }
        >
          <SnakeBoard
            foodFeedbacks={foodFeedbacks}
            game={game}
            onFoodFeedbackAnimationEnd={removeFoodFeedback}
            statusLabel={statusLabels[game.status]}
          >
            {showStartScreen ? (
              <div
                className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[var(--snake-board)] px-4 py-5 text-center text-[var(--snake-board-text)]"
                data-testid="snake-start-screen"
              >
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="grid grid-cols-5 gap-1"
                    aria-hidden="true"
                  >
                    {START_SCREEN_CELLS.map(({ index, isSnake }) => (
                      <span
                        className={cn(
                          "size-3 rounded-[0.18rem] bg-[var(--snake-grid)]",
                          isSnake && "bg-[var(--snake-head)]",
                        )}
                        key={index}
                      />
                    ))}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-3xl font-semibold tracking-normal text-balance">
                      Classic Snake
                    </p>
                    <p
                      className="text-sm font-medium text-[color-mix(in_oklch,var(--snake-board-text)_74%,transparent)]"
                      aria-live="polite"
                    >
                      {statusLabels[game.status]}
                    </p>
                  </div>
                </div>
                <GameLeaderboardPanel
                  slotTestIdPrefix="snake-leaderboard-slot"
                  slots={leaderboardSlots}
                  statusMessage={leaderboardStatusMessage}
                  testId="snake-start-leaderboard"
                />
                <Button
                  className="min-w-32"
                  data-testid="snake-start-button"
                  onClick={toggleRunState}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <PlayIcon data-icon="inline-start" />
                  Start
                </Button>
              </div>
            ) : showGameOverScreen ? (
              <div
                className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[color-mix(in_oklch,var(--snake-board)_78%,transparent)] px-4 py-5 text-center text-[var(--snake-board-text)] backdrop-blur-[2px]"
                data-testid="snake-game-over-screen"
              >
                {pendingLeaderboardEntry ? (
                  <>
                    <GameLeaderboardScoreForm
                      isSaving={isSavingLeaderboardScore}
                      onPlayerNameChange={setPlayerName}
                      onSaveScore={saveLeaderboardScore}
                      pendingEntry={pendingLeaderboardEntry}
                      playerName={playerName}
                      saveFailed={scoreSaveFailed}
                      testIdPrefix="snake"
                    />
                    <GameLeaderboardPanel
                      slotTestIdPrefix="snake-final-leaderboard-slot"
                      slots={leaderboardSlots}
                      statusMessage={leaderboardStatusMessage}
                      testId="snake-final-leaderboard"
                    />
                  </>
                ) : (
                  <>
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-3xl font-semibold tracking-normal text-balance">
                        {statusLabels[game.status]}
                      </p>
                      <div className="flex flex-col items-center gap-0.5">
                        <p className="text-sm font-semibold text-[color-mix(in_oklch,var(--snake-board-text)_76%,transparent)]">
                          Your score:
                        </p>
                        <p className="font-mono text-4xl font-semibold leading-none">
                          {game.score}
                        </p>
                      </div>
                    </div>
                    <GameLeaderboardPanel
                      slotTestIdPrefix="snake-final-leaderboard-slot"
                      slots={leaderboardSlots}
                      statusMessage={leaderboardStatusMessage}
                      testId="snake-final-leaderboard"
                    />
                    <Button
                      className="min-w-36"
                      data-testid="snake-new-game-button"
                      onClick={restartGame}
                      size="lg"
                      type="button"
                      variant="secondary"
                    >
                      <RotateCcwIcon data-icon="inline-start" />
                      New game
                    </Button>
                  </>
                )}
              </div>
            ) : showBoardState ? (
              <div
                className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--snake-board)_72%,transparent)] text-center text-[var(--snake-board-text)] backdrop-blur-[2px]"
                data-testid="snake-board-state"
              >
                <p className="text-2xl font-semibold tracking-normal">
                  {statusLabels[game.status]}
                </p>
              </div>
            ) : null}
            {isHelpVisible ? (
              <GameHelpScreen
                className="border-[color-mix(in_oklch,var(--snake-board-text)_24%,transparent)] bg-[color-mix(in_oklch,var(--snake-board)_94%,black)] text-[var(--snake-board-text)]"
                onClose={closeHelp}
                sections={SNAKE_HELP_SECTIONS}
                testId="snake-help-screen"
                title="Classic Snake"
              />
            ) : null}
          </SnakeBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}
