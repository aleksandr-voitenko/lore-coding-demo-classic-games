"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  PlayIcon,
  RotateCcwIcon,
  SaveIcon,
} from "lucide-react";
import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  GameBoardActions,
  GameBoardColumn,
  GameBoardStage,
  GameHeader,
  GameHelpScreen,
  GameShell,
  GameSidebar,
  useGameHelpScreen,
  type GameHelpSection,
} from "@/components/game-layout";
import { isTypingTarget } from "@/components/game-input";
import { SnakeBoard } from "@/components/snake-board";
import { Button } from "@/components/ui/button";
import {
  advanceSnakeGame,
  BOARD_SIZE_OPTIONS,
  createInitialGame,
  expireTimedFood,
  getGameTickDelay,
  getTimedFoodSpawnDelay,
  MAX_BOARD_SIZE,
  MIN_BOARD_SIZE,
  normalizeBoardSize,
  queueGameDirection,
  spawnTimedFood,
  type Direction,
  type GameState,
  type GameStatus,
  type LeaderboardEntry,
  type TimedFoodKind,
} from "@/lib/snake-game-engine";
import { createFoodFeedback, type FoodFeedback } from "@/lib/snake-food-feedback";
import { MAX_LEADERBOARD_PLAYER_NAME_LENGTH } from "@/lib/snake-leaderboard";
import { cn } from "@/lib/utils";
import { useSnakeLeaderboard } from "@/hooks/use-snake-leaderboard";

type LeaderboardPanelProps = {
  slotTestIdPrefix: string;
  slots: Array<LeaderboardEntry | null>;
  statusMessage?: string;
  testId: string;
};

type TimedFoodLifecycleOptions = {
  gameStatus: GameStatus;
  kind: TimedFoodKind;
  setGame: Dispatch<SetStateAction<GameState>>;
  timedFood: GameState[TimedFoodKind];
};

type SnakeGameProps = {
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

function LeaderboardPanel({
  slotTestIdPrefix,
  slots,
  statusMessage,
  testId,
}: LeaderboardPanelProps) {
  return (
    <div
      className="flex w-full max-w-xs flex-col gap-2 rounded-md border border-[color-mix(in_oklch,var(--snake-board-text)_14%,transparent)] bg-[color-mix(in_oklch,var(--snake-grid)_42%,transparent)] p-3"
      data-testid={testId}
    >
      <p className="text-sm font-semibold">Leaderboard</p>
      <ol className="flex flex-col gap-1">
        {slots.map((entry, index) => (
          <li
            className="grid grid-cols-[1.75rem_minmax(0,1fr)_3rem] items-center gap-2 rounded-md bg-[color-mix(in_oklch,var(--snake-board)_70%,transparent)] px-2 py-1.5 text-sm"
            data-testid={`${slotTestIdPrefix}-${index + 1}`}
            key={index}
          >
            <span className="font-mono text-xs font-semibold text-[color-mix(in_oklch,var(--snake-board-text)_70%,transparent)]">
              {index + 1}
            </span>
            <span className="truncate text-left font-medium">
              {entry ? entry.name || "Anonymous" : "Open"}
            </span>
            <span className="text-right font-mono font-semibold">
              {entry?.score ?? "-"}
            </span>
          </li>
        ))}
      </ol>
      {statusMessage ? (
        <p
          aria-live="polite"
          className="text-xs font-medium text-[color-mix(in_oklch,var(--snake-board-text)_68%,transparent)]"
          data-testid={`${testId}-status`}
        >
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}

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

export function SnakeGame({ onBackToMenu }: SnakeGameProps = {}) {
  const [game, setGame] = useState<GameState>(() => createInitialGame());
  const [foodFeedbacks, setFoodFeedbacks] = useState<FoodFeedback[]>([]);
  const foodFeedbackIdRef = useRef(0);
  const previousGameRef = useRef(game);
  const pendingLeaderboardEntry = game.pendingLeaderboardEntry;
  const {
    isSavingLeaderboardScore,
    leaderboard,
    leaderboardBestScore,
    leaderboardSlots,
    leaderboardStatusMessage,
    playerName,
    resetLeaderboardForm,
    saveLeaderboardScore: savePendingLeaderboardScore,
    scoreSaveFailed,
    setPlayerName,
  } = useSnakeLeaderboard({
    boardSize: game.boardSize,
    pendingLeaderboardEntry,
    setGame,
  });
  const bestScore = Math.max(game.bestScore, leaderboardBestScore);
  const speed = getGameTickDelay({
    score: game.score,
    speedBoosts: game.speedBoosts,
    status: game.status,
  });
  const canSelectBoardSize =
    game.status === "ready" ||
    ((game.status === "lost" || game.status === "won") && pendingLeaderboardEntry === null);

  const selectBoardSize = useCallback(
    (nextBoardSize: number) => {
      const boardSize = normalizeBoardSize(nextBoardSize);

      resetLeaderboardForm();
      setFoodFeedbacks([]);
      setGame((current) => {
        if (
          current.status === "running" ||
          current.status === "paused" ||
          current.pendingLeaderboardEntry !== null ||
          current.boardSize === boardSize
        ) {
          return current;
        }

        return createInitialGame({
          bestScore: Math.max(current.bestScore, leaderboardBestScore),
          boardSize,
          random: Math.random,
        });
      });
    },
    [leaderboardBestScore, resetLeaderboardForm],
  );

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

  const { closeHelp, isHelpVisible, openHelp } = useGameHelpScreen({
    isGameActive: game.status === "running",
    onPauseGame: pauseGameForHelp,
    onResumeGame: resumeGameAfterHelp,
  });

  const saveLeaderboardScore = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void savePendingLeaderboardScore();
    },
    [savePendingLeaderboardScore],
  );

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

  const canPauseGame = game.status === "running" || game.status === "paused";
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const showStartScreen = game.status === "ready";
  const showGameOverScreen = game.status === "lost" || game.status === "won";
  const showBoardState = game.status !== "running";

  return (
    <GameShell className="bg-[var(--snake-page)] text-[var(--snake-ink)]">
      <GameSidebar className="border-[var(--snake-border)] bg-[var(--snake-panel)]">
        <GameHeader
          accentClassName="bg-[var(--snake-accent)]"
          backButtonTestId="snake-back-to-menu"
          onBackToMenu={onBackToMenu}
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
          </dl>

          <div className="flex flex-col gap-2 rounded-md border border-[var(--snake-border)] p-3">
            <label
              className="text-xs font-medium text-[var(--snake-muted)]"
              htmlFor="snake-board-size"
            >
              Field size
            </label>
            <select
              aria-label={`Field size. Selectable from ${MIN_BOARD_SIZE} by ${MIN_BOARD_SIZE} to ${MAX_BOARD_SIZE} by ${MAX_BOARD_SIZE}.`}
              className="h-9 w-full rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] px-3 text-sm font-semibold text-[var(--snake-ink)] outline-none transition disabled:cursor-not-allowed disabled:opacity-55 focus-visible:border-[var(--snake-head)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)]"
              data-testid="snake-board-size"
              disabled={!canSelectBoardSize}
              id="snake-board-size"
              onChange={(event) => selectBoardSize(Number(event.target.value))}
              value={game.boardSize}
            >
              {BOARD_SIZE_OPTIONS.map((boardSize) => (
                <option
                  key={boardSize}
                  value={boardSize}
                >
                  {boardSize} x {boardSize}
                </option>
              ))}
            </select>
          </div>

          <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
            <div className="grid w-32 grid-cols-3 gap-2">
              <Button
                aria-label="Move up"
                className="col-start-2"
                onClick={() => queueDirection("up")}
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <ArrowUpIcon />
              </Button>
              <Button
                aria-label="Move left"
                className="col-start-1 row-start-2"
                onClick={() => queueDirection("left")}
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <ArrowLeftIcon />
              </Button>
              <Button
                aria-label="Move down"
                className="col-start-2 row-start-2"
                onClick={() => queueDirection("down")}
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <ArrowDownIcon />
              </Button>
              <Button
                aria-label="Move right"
                className="col-start-3 row-start-2"
                onClick={() => queueDirection("right")}
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <ArrowRightIcon />
              </Button>
            </div>
          </div>
      </GameSidebar>

      <GameBoardColumn className="max-w-[min(92vw,41.25rem)]">
        <GameBoardStage
          actions={
            <GameBoardActions
              helpDisabled={isHelpVisible}
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
                <LeaderboardPanel
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
                    <form
                      className="flex w-full max-w-xs flex-col items-center gap-3"
                      data-testid="snake-leaderboard-form"
                      onSubmit={saveLeaderboardScore}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-sm font-semibold">
                          Top {pendingLeaderboardEntry.rank + 1} score
                        </p>
                        <p
                          className="font-mono text-5xl font-semibold leading-none"
                          data-testid="snake-qualifying-score"
                        >
                          {pendingLeaderboardEntry.score}
                        </p>
                      </div>
                      <div className="flex w-full flex-col gap-1 text-left">
                        <label
                          className="text-xs font-medium text-[color-mix(in_oklch,var(--snake-board-text)_76%,transparent)]"
                          htmlFor="snake-player-name"
                        >
                          Name
                        </label>
                        <input
                          autoComplete="name"
                          autoFocus
                          className="h-9 w-full rounded-md border border-[color-mix(in_oklch,var(--snake-board-text)_22%,transparent)] bg-[color-mix(in_oklch,var(--snake-board-text)_10%,transparent)] px-3 text-sm font-medium text-[var(--snake-board-text)] outline-none transition placeholder:text-[color-mix(in_oklch,var(--snake-board-text)_54%,transparent)] focus-visible:border-[var(--snake-head)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_35%,transparent)]"
                          data-testid="snake-player-name"
                          disabled={isSavingLeaderboardScore}
                          id="snake-player-name"
                          maxLength={MAX_LEADERBOARD_PLAYER_NAME_LENGTH}
                          onChange={(event) => setPlayerName(event.target.value)}
                          placeholder="Player name"
                          type="text"
                          value={playerName}
                        />
                      </div>
                      <div className="w-full">
                        <Button
                          className="w-full"
                          data-testid="snake-save-score-button"
                          disabled={isSavingLeaderboardScore}
                          size="lg"
                          type="submit"
                          variant="secondary"
                        >
                          <SaveIcon data-icon="inline-start" />
                          {isSavingLeaderboardScore ? "Saving" : "Save"}
                        </Button>
                      </div>
                      {scoreSaveFailed ? (
                        <p
                          aria-live="polite"
                          className="text-xs font-medium text-[color-mix(in_oklch,var(--snake-board-text)_76%,transparent)]"
                          data-testid="snake-save-score-error"
                        >
                          Could not save score. Try again.
                        </p>
                      ) : null}
                    </form>
                    <LeaderboardPanel
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
                    <LeaderboardPanel
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

          <div className="flex items-center justify-between rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] px-3 py-2 text-xs font-medium text-[var(--snake-muted)]">
            <span data-testid="snake-length">Length {game.snake.length}</span>
            <span data-testid="snake-speed">
              Speed {speed === null ? "0" : `${Math.round(1000 / speed)}`}
            </span>
          </div>
      </GameBoardColumn>
    </GameShell>
  );
}
