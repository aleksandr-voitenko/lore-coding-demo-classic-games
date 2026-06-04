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
  shouldIgnoreGameKeyDown,
} from "@/components/game-input";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { SnakeBoard, snakeSpriteSources } from "@/components/snake-board";
import { Button } from "@/components/ui/button";
import {
  advanceSnakeGame,
  createInitialGame,
  expireTimedFood,
  getGameTickDelay,
  getTimedFoodSpawnDelay,
  isPickupIntroduced,
  queueGameDirection,
  spawnTimedFood,
  type Direction,
  type GameState,
  type GameStatus,
  type TimedFoodKind,
} from "@/lib/snake-game-engine";
import { createFoodFeedback, type FoodFeedback } from "@/lib/snake-food-feedback";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import { useGameSession } from "@/hooks/use-game-session";

type TimedFoodLifecycleOptions = {
  gameStatus: GameStatus;
  isIntroduced: boolean;
  kind: TimedFoodKind;
  setGame: Dispatch<SetStateAction<GameState>>;
  timedFood: GameState[TimedFoodKind];
};

type SnakeGameProps = {
  initialBoardSize?: number;
  onBackToMenu?: () => void;
};

const START_SCREEN_CELLS: Array<{
  className?: string;
  rotationDeg?: number;
  spriteSrc: string;
}> = [
  {
    rotationDeg: 90,
    spriteSrc: snakeSpriteSources.tail,
  },
  {
    rotationDeg: 90,
    spriteSrc: snakeSpriteSources.bodyStraight,
  },
  {
    rotationDeg: 90,
    spriteSrc: snakeSpriteSources.bodyStraight,
  },
  {
    rotationDeg: 90,
    spriteSrc: snakeSpriteSources.head,
  },
  {
    className: "scale-90",
    spriteSrc: snakeSpriteSources.foodRedApple,
  },
];

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
        buttons: [{ text: "P", label: "P key" }],
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
  isIntroduced,
  kind,
  setGame,
  timedFood,
}: TimedFoodLifecycleOptions) {
  useEffect(() => {
    if (gameStatus !== "running" || timedFood !== null || !isIntroduced) {
      return;
    }

    const spawn = window.setTimeout(() => {
      setGame((current) => spawnTimedFood(current, kind));
    }, getTimedFoodSpawnDelay(kind));

    return () => window.clearTimeout(spawn);
  }, [gameStatus, isIntroduced, kind, setGame, timedFood]);

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
  const { completedSessionId } = useGameSession({
    active: game.status === "running",
    finalResult:
      game.status === "lost" || game.status === "won" ? game.status : null,
    finalScore: game.score,
    gameId: "snake",
    leaderboardKey,
    started: game.status !== "ready",
  });
  const {
    finalLeaderboardProps,
    leaderboardBestScore,
    leaderboardPanelProps,
    pendingLeaderboardEntry,
    resetLeaderboardForm,
    scoreFormProps,
  } = useGameLeaderboardPresenter({
    gameSessionId: completedSessionId,
    leaderboardKey,
    pendingScore: pendingLeaderboardScore,
    testIdPrefix: "snake",
  });
  const bestScore = Math.max(game.bestScore, leaderboardBestScore);
  const speed = getGameTickDelay({
    pickedUpObjects: game.pickedUpObjects,
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
    setGame((current) => advanceSnakeGame(current));
  }, []);

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
    isIntroduced: isPickupIntroduced("bonusFood", game.pickedUpObjects),
    kind: "bonusFood",
    setGame,
    timedFood: game.bonusFood,
  });
  useTimedFoodLifecycle({
    gameStatus: game.status,
    isIntroduced: isPickupIntroduced("speedFood", game.pickedUpObjects),
    kind: "speedFood",
    setGame,
    timedFood: game.speedFood,
  });
  useTimedFoodLifecycle({
    gameStatus: game.status,
    isIntroduced: isPickupIntroduced("slowFood", game.pickedUpObjects),
    kind: "slowFood",
    setGame,
    timedFood: game.slowFood,
  });
  useTimedFoodLifecycle({
    gameStatus: game.status,
    isIntroduced: isPickupIntroduced("shrinkFood", game.pickedUpObjects),
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
      if (
        shouldIgnoreGameKeyDown(event, {
          hasPendingLeaderboardEntry: pendingLeaderboardEntry !== null,
          isHelpVisible,
        })
      ) {
        return;
      }

      const nextDirection = keyDirections[event.key];

      if (nextDirection) {
        event.preventDefault();
        queueDirection(nextDirection);
        return;
      }

      if (isGamePauseKey(event.key)) {
        event.preventDefault();
        toggleRunState();
        return;
      }

      if (event.key === " " && game.status === "ready") {
        event.preventDefault();
        toggleRunState();
      }

      if (event.key === "Enter" && (game.status === "lost" || game.status === "won")) {
        event.preventDefault();
        restartGame();
      }
    }

    return registerGameKeyDown(handleKeyDown);
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
      <GameBoardColumn className="w-[min(92vw,41.25rem,calc(100svh_-_12rem))]">
        <GameSidebar className="border-[var(--snake-border)] bg-[var(--snake-panel)]">
          <GameHeader
            status={statusLabels[game.status]}
            statusTestId="snake-status"
            title="Classic Snake"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--snake-border)]"
              label="Score"
              labelClassName="text-[var(--snake-muted)]"
              value={game.score}
              valueTestId="snake-score"
            />
            <GameStatCard
              className="border-[var(--snake-border)]"
              label="Best"
              labelClassName="text-[var(--snake-muted)]"
              value={bestScore}
              valueTestId="snake-best"
            />
            <GameStatCard
              className="border-[var(--snake-border)]"
              label="Length"
              labelClassName="text-[var(--snake-muted)]"
              value={game.snake.length}
              valueTestId="snake-length"
            />
            <GameStatCard
              className="border-[var(--snake-border)]"
              label="Speed"
              labelClassName="text-[var(--snake-muted)]"
              value={speed === null ? "0" : `${Math.round(1000 / speed)}`}
              valueTestId="snake-speed"
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
                  <div className="grid grid-cols-5 gap-1" aria-hidden="true">
                    {START_SCREEN_CELLS.map(({ className, rotationDeg = 0, spriteSrc }, index) => (
                      <span
                        className="relative size-9 overflow-visible rounded-[0.18rem] bg-[var(--snake-board-cell)] bg-cover bg-center bg-no-repeat shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--snake-grid)_60%,transparent)] sm:size-10"
                        key={`${spriteSrc}-${index}`}
                        style={{ backgroundImage: `url("${snakeSpriteSources.floorCell}")` }}
                      >
                        <span
                          className={[
                            "absolute inset-0 bg-contain bg-center bg-no-repeat drop-shadow-[0_3px_5px_color-mix(in_oklch,black_28%,transparent)]",
                            className,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={{
                            backgroundImage: `url("${spriteSrc}")`,
                            transform: rotationDeg === 0 ? undefined : `rotate(${rotationDeg}deg)`,
                          }}
                        />
                      </span>
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
                <GameLeaderboardPanel {...leaderboardPanelProps} />
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
              <GameEndScreen testId="snake-game-over-screen">
                <GameEndLeaderboardContent
                  action={
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
                  }
                  leaderboard={finalLeaderboardProps}
                  pendingLeaderboardEntry={pendingLeaderboardEntry}
                  scoreForm={scoreFormProps}
                  summary={{
                    metricLabel: "Your score:",
                    metricValue: game.score,
                    metricValueTestId: "snake-final-score",
                    title: statusLabels[game.status],
                  }}
                />
              </GameEndScreen>
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
