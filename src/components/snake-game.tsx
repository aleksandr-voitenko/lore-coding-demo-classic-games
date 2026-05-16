"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  PauseIcon,
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
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  advanceSnakeGame,
  BOARD_SIZE_OPTIONS,
  createBoardCells,
  createInitialGame,
  expireTimedFood,
  getActiveTimedFoodEntries,
  getGameTickDelay,
  getPointKey,
  getTimedFoodSpawnDelay,
  isTimedFoodKind,
  LEADERBOARD_LIMIT,
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
import {
  fetchLeaderboard,
  MAX_LEADERBOARD_PLAYER_NAME_LENGTH,
  submitLeaderboardScore,
} from "@/lib/snake-leaderboard";
import { cn } from "@/lib/utils";

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

type BoardCellType = "body" | "food" | "head" | "obstacle" | TimedFoodKind;

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

const timedFoodCellClassNames: Record<TimedFoodKind, string> = {
  bonusFood:
    "rounded-full bg-[var(--snake-bonus-food)] shadow-[0_0_20px_color-mix(in_oklch,var(--snake-bonus-food)_58%,transparent)]",
  speedFood:
    "scale-75 rotate-45 rounded-[0.08rem] bg-[var(--snake-speed-food)] shadow-[0_0_20px_color-mix(in_oklch,var(--snake-speed-food)_60%,transparent)]",
  slowFood:
    "scale-90 rounded-none bg-[var(--snake-slow-food)] shadow-[0_0_20px_color-mix(in_oklch,var(--snake-slow-food)_62%,transparent)] [clip-path:polygon(50%_8%,92%_88%,8%_88%)]",
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "SELECT" ||
    target.tagName === "TEXTAREA"
  );
}

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

export function SnakeGame() {
  const [game, setGame] = useState<GameState>(() => createInitialGame());
  const [foodFeedbacks, setFoodFeedbacks] = useState<FoodFeedback[]>([]);
  const [isSavingLeaderboardScore, setIsSavingLeaderboardScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoadFailed, setLeaderboardLoadFailed] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [scoreSaveFailed, setScoreSaveFailed] = useState(false);
  const foodFeedbackIdRef = useRef(0);
  const previousGameRef = useRef(game);
  const leaderboardBestScore = leaderboard[0]?.score ?? 0;
  const bestScore = Math.max(game.bestScore, leaderboardBestScore);
  const pendingLeaderboardEntry = game.pendingLeaderboardEntry;
  const leaderboardStatusMessage = leaderboardLoadFailed ? "Leaderboard unavailable" : undefined;
  const boardCells = useMemo(() => createBoardCells(game.boardSize), [game.boardSize]);
  const activeTimedFoodEntries = useMemo(
    () =>
      getActiveTimedFoodEntries({
        bonusFood: game.bonusFood,
        slowFood: game.slowFood,
        speedFood: game.speedFood,
      }),
    [game.bonusFood, game.slowFood, game.speedFood],
  );
  const activeTimedFoodLabel = activeTimedFoodEntries
    .map(({ rule }) => ` ${rule.label} active.`)
    .join("");

  const occupiedCells = useMemo(() => {
    const cells = new Map<string, BoardCellType>();

    game.obstacles.forEach((obstacle) => {
      cells.set(getPointKey(obstacle), "obstacle");
    });
    if (game.food !== null) {
      cells.set(getPointKey(game.food), "food");
    }
    activeTimedFoodEntries.forEach(({ kind, timedFood }) => {
      cells.set(getPointKey(timedFood.position), kind);
    });
    game.snake.forEach((segment, index) => {
      cells.set(getPointKey(segment), index === 0 ? "head" : "body");
    });

    return cells;
  }, [activeTimedFoodEntries, game.food, game.obstacles, game.snake]);

  const speed = useMemo(() => {
    return getGameTickDelay({
      score: game.score,
      speedBoosts: game.speedBoosts,
      status: game.status,
    });
  }, [game.score, game.speedBoosts, game.status]);

  const leaderboardSlots = useMemo(
    () => Array.from({ length: LEADERBOARD_LIMIT }, (_, index) => leaderboard[index] ?? null),
    [leaderboard],
  );
  const canSelectBoardSize =
    game.status === "ready" ||
    ((game.status === "lost" || game.status === "won") && pendingLeaderboardEntry === null);

  const selectBoardSize = useCallback(
    (nextBoardSize: number) => {
      const boardSize = normalizeBoardSize(nextBoardSize);

      setPlayerName("");
      setScoreSaveFailed(false);
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
    [leaderboardBestScore],
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

  useEffect(() => {
    let isCurrent = true;

    fetchLeaderboard()
      .then((nextLeaderboard) => {
        if (!isCurrent) {
          return;
        }

        setLeaderboard(nextLeaderboard);
        setLeaderboardLoadFailed(false);
      })
      .catch(() => {
        if (isCurrent) {
          setLeaderboardLoadFailed(true);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const toggleRunState = useCallback(() => {
    setPlayerName("");
    setScoreSaveFailed(false);
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
  }, [leaderboardBestScore]);

  const restartGame = useCallback(() => {
    setPlayerName("");
    setScoreSaveFailed(false);
    setFoodFeedbacks([]);
    setGame((current) => ({
      ...createInitialGame({
        bestScore: Math.max(current.bestScore, leaderboardBestScore),
        boardSize: current.boardSize,
        random: Math.random,
      }),
      status: "running",
    }));
  }, [leaderboardBestScore]);

  const saveLeaderboardScore = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (pendingLeaderboardEntry === null || isSavingLeaderboardScore) {
        return;
      }

      setIsSavingLeaderboardScore(true);
      setScoreSaveFailed(false);

      try {
        const result = await submitLeaderboardScore({
          boardSize: game.boardSize,
          name: playerName,
          score: pendingLeaderboardEntry.score,
        });
        const nextBestScore = result.entries[0]?.score ?? 0;

        setLeaderboard(result.entries);
        setLeaderboardLoadFailed(false);
        setGame((current) => ({
          ...current,
          bestScore: Math.max(current.bestScore, nextBestScore),
          pendingLeaderboardEntry: null,
        }));
        setPlayerName("");
      } catch {
        setLeaderboardLoadFailed(true);
        setScoreSaveFailed(true);
      } finally {
        setIsSavingLeaderboardScore(false);
      }
    },
    [game.boardSize, isSavingLeaderboardScore, pendingLeaderboardEntry, playerName],
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

  useEffect(() => {
    if (speed === null) {
      return;
    }

    const tick = window.setInterval(advanceSnake, speed);

    return () => window.clearInterval(tick);
  }, [advanceSnake, speed]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
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
  }, [game.status, pendingLeaderboardEntry, queueDirection, restartGame, toggleRunState]);

  const primaryAction =
    game.status === "running" ? "Pause" : game.status === "paused" ? "Resume" : "Start";
  const PrimaryIcon = game.status === "running" ? PauseIcon : PlayIcon;
  const showStartScreen = game.status === "ready";
  const showGameOverScreen = game.status === "lost" || game.status === "won";
  const showSideActions = game.status === "running" || game.status === "paused";
  const showBoardState = game.status !== "running";

  return (
    <main className="min-h-svh bg-[var(--snake-page)] px-4 py-6 text-[var(--snake-ink)] sm:px-6 lg:py-8">
      <section className="mx-auto grid w-full max-w-6xl gap-5 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)] lg:items-center">
        <aside className="flex flex-col gap-4 rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] p-4 shadow-sm">
          <div className="flex flex-col gap-2">
            <div
              className="h-2 w-14 rounded-full bg-[var(--snake-accent)]"
              aria-hidden="true"
            />
            <h1 className="text-3xl font-semibold tracking-normal text-balance">
              Classic Snake
            </h1>
            <p
              className="text-sm font-medium text-[var(--snake-muted)]"
              aria-live="polite"
              data-testid="snake-status"
            >
              {statusLabels[game.status]}
            </p>
          </div>

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
            {showSideActions ? (
              <div className="grid w-full grid-cols-[minmax(0,1fr)_2rem] gap-2">
                <Button onClick={toggleRunState} type="button">
                  <PrimaryIcon data-icon="inline-start" />
                  {primaryAction}
                </Button>
                <Button
                  aria-label="Restart"
                  onClick={restartGame}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <RotateCcwIcon />
                </Button>
              </div>
            ) : null}

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
        </aside>

        <div className="mx-auto flex w-full max-w-[min(92vw,38rem)] flex-col gap-3">
          <div className="relative aspect-square overflow-hidden rounded-md border border-[var(--snake-board-border)] bg-[var(--snake-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--snake-board)_24%,transparent)]">
            <div
              aria-label={`Snake board. Field ${game.boardSize} by ${game.boardSize}. Score ${game.score}. ${statusLabels[game.status]}.${
                game.obstacles.length === 0 ? "" : ` ${game.obstacles.length} obstacle blocks.`
              }${activeTimedFoodLabel}`}
              className="grid size-full gap-px rounded-[0.375rem] bg-[var(--snake-grid)] p-px"
              data-testid="snake-board"
              role="img"
              style={{
                gridTemplateColumns: `repeat(${game.boardSize}, minmax(0, 1fr))`,
              }}
            >
              {boardCells.map((cell) => {
                const cellType = occupiedCells.get(getPointKey(cell));
                const timedFoodCellClassName = isTimedFoodKind(cellType)
                  ? timedFoodCellClassNames[cellType]
                  : null;

                return (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "aspect-square rounded-[0.18rem] bg-[var(--snake-board-cell)] transition-colors",
                      cellType === "body" &&
                        "bg-[var(--snake-body)] shadow-[inset_0_-2px_0_color-mix(in_oklch,var(--snake-board)_22%,transparent)]",
                      cellType === "head" &&
                        "bg-[var(--snake-head)] shadow-[0_0_0_1px_color-mix(in_oklch,var(--snake-head)_42%,white),inset_0_-2px_0_color-mix(in_oklch,var(--snake-board)_25%,transparent)]",
                      cellType === "food" &&
                        "rounded-full bg-[var(--snake-food)] shadow-[0_0_18px_color-mix(in_oklch,var(--snake-food)_48%,transparent)]",
                      cellType === "obstacle" &&
                        "rounded-[0.12rem] bg-[var(--snake-obstacle)] shadow-[inset_0_1px_0_color-mix(in_oklch,var(--snake-obstacle-edge)_65%,transparent),inset_0_-2px_0_color-mix(in_oklch,black_28%,transparent)]",
                      timedFoodCellClassName,
                    )}
                    key={getPointKey(cell)}
                  />
                );
              })}
            </div>

            {game.status === "running" ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-2 overflow-hidden rounded-[0.375rem]"
              >
                {foodFeedbacks.map((feedback) => (
                  <div
                    className="snake-food-feedback absolute z-10 flex min-w-12 flex-col items-center justify-center gap-0.5 rounded-md border border-[color-mix(in_oklch,var(--snake-board-text)_28%,transparent)] bg-[color-mix(in_oklch,var(--snake-board)_80%,transparent)] px-2 py-1 text-center text-sm font-black leading-none text-[var(--snake-board-text)] shadow-[0_10px_24px_color-mix(in_oklch,var(--snake-board)_38%,transparent)] backdrop-blur-[1px]"
                    data-testid="snake-food-feedback"
                    key={feedback.id}
                    onAnimationEnd={() => removeFoodFeedback(feedback.id)}
                    style={{
                      left: `${((feedback.position.x + 0.5) / game.boardSize) * 100}%`,
                      top: `${((feedback.position.y + 0.5) / game.boardSize) * 100}%`,
                    }}
                  >
                    {feedback.lines.map((line, index) => (
                      <span
                        className="whitespace-nowrap"
                        key={`${feedback.id}-${index}`}
                      >
                        {line}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}

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
          </div>

          <div className="flex items-center justify-between rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] px-3 py-2 text-xs font-medium text-[var(--snake-muted)]">
            <span data-testid="snake-length">Length {game.snake.length}</span>
            <span data-testid="snake-speed">
              Speed {speed === null ? "0" : `${Math.round(1000 / speed)}`}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
