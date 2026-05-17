"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronsDownIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  RotateCwIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  advanceTetrisGame,
  createInitialTetrisGame,
  createTetrisBoardCells,
  getTetrominoPreviewCells,
  getTetrisTickDelay,
  hardDropTetrisPiece,
  moveTetrisPiece,
  pauseTetrisGame,
  renderTetrisBoard,
  rotateTetrisPiece,
  softDropTetrisPiece,
  startTetrisGame,
  TETRIS_BOARD_HEIGHT,
  TETRIS_BOARD_WIDTH,
  type TetrominoKind,
  type TetrisGameState,
  type TetrisStatus,
} from "@/lib/tetris-game-engine";
import { cn } from "@/lib/utils";

type TetrisGameProps = {
  onBackToMenu?: () => void;
};

const statusLabels: Record<TetrisStatus, string> = {
  lost: "Game over",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
};

const tetrominoCellClassNames: Record<TetrominoKind, string> = {
  I: "bg-[var(--tetris-cyan)] shadow-[inset_0_-2px_0_color-mix(in_oklch,black_18%,transparent),0_0_16px_color-mix(in_oklch,var(--tetris-cyan)_32%,transparent)]",
  J: "bg-[var(--tetris-blue)] shadow-[inset_0_-2px_0_color-mix(in_oklch,black_18%,transparent),0_0_16px_color-mix(in_oklch,var(--tetris-blue)_32%,transparent)]",
  L: "bg-[var(--tetris-orange)] shadow-[inset_0_-2px_0_color-mix(in_oklch,black_18%,transparent),0_0_16px_color-mix(in_oklch,var(--tetris-orange)_32%,transparent)]",
  O: "bg-[var(--tetris-yellow)] shadow-[inset_0_-2px_0_color-mix(in_oklch,black_18%,transparent),0_0_16px_color-mix(in_oklch,var(--tetris-yellow)_32%,transparent)]",
  S: "bg-[var(--tetris-green)] shadow-[inset_0_-2px_0_color-mix(in_oklch,black_18%,transparent),0_0_16px_color-mix(in_oklch,var(--tetris-green)_32%,transparent)]",
  T: "bg-[var(--tetris-purple)] shadow-[inset_0_-2px_0_color-mix(in_oklch,black_18%,transparent),0_0_16px_color-mix(in_oklch,var(--tetris-purple)_32%,transparent)]",
  Z: "bg-[var(--tetris-red)] shadow-[inset_0_-2px_0_color-mix(in_oklch,black_18%,transparent),0_0_16px_color-mix(in_oklch,var(--tetris-red)_32%,transparent)]",
};

const START_SCREEN_BLOCKS = [
  { kind: "T", x: 1, y: 0 },
  { kind: "T", x: 0, y: 1 },
  { kind: "T", x: 1, y: 1 },
  { kind: "T", x: 2, y: 1 },
  { kind: "O", x: 4, y: 1 },
  { kind: "O", x: 5, y: 1 },
  { kind: "O", x: 4, y: 2 },
  { kind: "O", x: 5, y: 2 },
  { kind: "I", x: 0, y: 4 },
  { kind: "I", x: 1, y: 4 },
  { kind: "I", x: 2, y: 4 },
  { kind: "I", x: 3, y: 4 },
] satisfies Array<{ kind: TetrominoKind; x: number; y: number }>;

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

function createRunningTetrisGame() {
  return {
    ...createInitialTetrisGame({ random: Math.random }),
    status: "running" as const,
  };
}

export function TetrisGame({ onBackToMenu }: TetrisGameProps = {}) {
  const [game, setGame] = useState<TetrisGameState>(() => createInitialTetrisGame());
  const boardCells = useMemo(() => createTetrisBoardCells(), []);
  const renderedBoard = useMemo(() => renderTetrisBoard(game), [game]);
  const nextPreviewCells = useMemo(
    () =>
      new Map(
        getTetrominoPreviewCells(game.nextPieceKind).map((cell) => [
          `${cell.x}:${cell.y}`,
          game.nextPieceKind,
        ]),
      ),
    [game.nextPieceKind],
  );
  const tickDelay = game.status === "running" ? getTetrisTickDelay(game.level) : null;
  const primaryAction =
    game.status === "running" ? "Pause" : game.status === "paused" ? "Resume" : "Start";
  const PrimaryIcon = game.status === "running" ? PauseIcon : PlayIcon;
  const showStartScreen = game.status === "ready";
  const showGameOverScreen = game.status === "lost";
  const showPauseScreen = game.status === "paused";
  const showSideActions = game.status === "running" || game.status === "paused";

  const startGame = useCallback(() => {
    setGame((current) => startTetrisGame(current, { random: Math.random }));
  }, []);

  const toggleRunState = useCallback(() => {
    setGame((current) => {
      if (current.status === "running") {
        return pauseTetrisGame(current);
      }

      return startTetrisGame(current, { random: Math.random });
    });
  }, []);

  const restartGame = useCallback(() => {
    setGame(createRunningTetrisGame());
  }, []);

  const moveLeft = useCallback(() => {
    setGame((current) => moveTetrisPiece(current, -1, 0));
  }, []);

  const moveRight = useCallback(() => {
    setGame((current) => moveTetrisPiece(current, 1, 0));
  }, []);

  const softDrop = useCallback(() => {
    setGame((current) => softDropTetrisPiece(current, { random: Math.random }));
  }, []);

  const hardDrop = useCallback(() => {
    setGame((current) => hardDropTetrisPiece(current, { random: Math.random }));
  }, []);

  const rotateClockwise = useCallback(() => {
    setGame((current) => rotateTetrisPiece(current));
  }, []);

  const rotateCounterclockwise = useCallback(() => {
    setGame((current) => rotateTetrisPiece(current, "counterclockwise"));
  }, []);

  const advanceTetris = useCallback(() => {
    setGame((current) => advanceTetrisGame(current, { random: Math.random }));
  }, []);

  useEffect(() => {
    if (tickDelay === null) {
      return;
    }

    const tick = window.setInterval(advanceTetris, tickDelay);

    return () => window.clearInterval(tick);
  }, [advanceTetris, tickDelay]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "Enter" && (game.status === "ready" || game.status === "lost")) {
        event.preventDefault();
        startGame();
        return;
      }

      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        toggleRunState();
        return;
      }

      if (game.status !== "running") {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
        event.preventDefault();
        moveLeft();
        return;
      }

      if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
        event.preventDefault();
        moveRight();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
        event.preventDefault();
        softDrop();
        return;
      }

      if (
        event.key === "ArrowUp" ||
        event.key === "w" ||
        event.key === "W" ||
        event.key === "x" ||
        event.key === "X"
      ) {
        event.preventDefault();
        rotateClockwise();
        return;
      }

      if (event.key === "z" || event.key === "Z") {
        event.preventDefault();
        rotateCounterclockwise();
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        hardDrop();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    game.status,
    hardDrop,
    moveLeft,
    moveRight,
    rotateClockwise,
    rotateCounterclockwise,
    softDrop,
    startGame,
    toggleRunState,
  ]);

  return (
    <main className="min-h-svh bg-[var(--tetris-page)] px-4 py-6 text-[var(--tetris-ink)] sm:px-6 lg:py-8">
      <section className="mx-auto grid w-full max-w-6xl gap-5 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)] lg:items-center">
        <aside className="flex flex-col gap-4 rounded-md border border-[var(--tetris-border)] bg-[var(--tetris-panel)] p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <div
                className="h-2 w-14 rounded-full bg-[linear-gradient(90deg,var(--tetris-cyan),var(--tetris-yellow),var(--tetris-purple))]"
                aria-hidden="true"
              />
              <h1 className="text-3xl font-semibold tracking-normal text-balance">
                Classic Tetris
              </h1>
              <p
                className="text-sm font-medium text-[var(--tetris-muted)]"
                aria-live="polite"
                data-testid="tetris-status"
              >
                {statusLabels[game.status]}
              </p>
            </div>
            {onBackToMenu ? (
              <Button
                aria-label="Back to game menu"
                data-testid="tetris-back-to-menu"
                onClick={onBackToMenu}
                size="icon"
                type="button"
                variant="outline"
              >
                <ArrowLeftIcon />
              </Button>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-[var(--tetris-border)] p-3">
              <dt className="text-xs font-medium text-[var(--tetris-muted)]">
                Score
              </dt>
              <dd
                className="font-mono text-3xl font-semibold leading-none"
                data-testid="tetris-score"
              >
                {game.score}
              </dd>
            </div>
            <div className="rounded-md border border-[var(--tetris-border)] p-3">
              <dt className="text-xs font-medium text-[var(--tetris-muted)]">
                Lines
              </dt>
              <dd
                className="font-mono text-3xl font-semibold leading-none"
                data-testid="tetris-lines"
              >
                {game.lines}
              </dd>
            </div>
          </dl>

          <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-3">
            <div className="rounded-md border border-[var(--tetris-border)] p-3">
              <p className="text-xs font-medium text-[var(--tetris-muted)]">
                Level
              </p>
              <p
                className="font-mono text-3xl font-semibold leading-none"
                data-testid="tetris-level"
              >
                {game.level}
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-[var(--tetris-border)] p-3">
              <p className="text-xs font-medium text-[var(--tetris-muted)]">
                Next
              </p>
              <div
                aria-label={`Next piece ${game.nextPieceKind}`}
                className="grid aspect-square grid-cols-4 gap-0.5 rounded-[0.375rem] bg-[var(--tetris-grid)] p-1"
                data-testid="tetris-next-piece"
                role="img"
              >
                {Array.from({ length: 16 }, (_, index) => {
                  const x = index % 4;
                  const y = Math.floor(index / 4);
                  const cellKind = nextPreviewCells.get(`${x}:${y}`) ?? null;

                  return (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "aspect-square rounded-[0.16rem] bg-[var(--tetris-board-cell)]",
                        cellKind && tetrominoCellClassNames[cellKind],
                      )}
                      key={`${x}:${y}`}
                    />
                  );
                })}
              </div>
            </div>
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

            <div className="grid w-full grid-cols-4 gap-2">
              <Button
                aria-label="Move left"
                onClick={moveLeft}
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <ArrowLeftIcon />
              </Button>
              <Button
                aria-label="Soft drop"
                onClick={softDrop}
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <ArrowDownIcon />
              </Button>
              <Button
                aria-label="Move right"
                onClick={moveRight}
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <ArrowRightIcon />
              </Button>
              <Button
                aria-label="Hard drop"
                onClick={hardDrop}
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <ChevronsDownIcon />
              </Button>
              <Button
                aria-label="Rotate counterclockwise"
                className="col-span-2"
                onClick={rotateCounterclockwise}
                type="button"
                variant="outline"
              >
                <RotateCcwIcon data-icon="inline-start" />
                Rotate
              </Button>
              <Button
                aria-label="Rotate clockwise"
                className="col-span-2"
                onClick={rotateClockwise}
                type="button"
                variant="outline"
              >
                <RotateCwIcon data-icon="inline-start" />
                Rotate
              </Button>
            </div>
          </div>
        </aside>

        <div className="mx-auto flex w-full max-w-[min(86vw,19rem)] flex-col gap-3">
          <div className="relative aspect-[1/2] overflow-hidden rounded-md border border-[var(--tetris-board-border)] bg-[var(--tetris-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--tetris-board)_26%,transparent)]">
            <div
              aria-label={`Tetris board. Field ${TETRIS_BOARD_WIDTH} by ${TETRIS_BOARD_HEIGHT}. Score ${game.score}. Lines ${game.lines}. Level ${game.level}. ${statusLabels[game.status]}.`}
              className="grid size-full gap-px rounded-[0.375rem] bg-[var(--tetris-grid)] p-px"
              data-testid="tetris-board"
              role="img"
              style={{
                gridTemplateColumns: `repeat(${TETRIS_BOARD_WIDTH}, minmax(0, 1fr))`,
              }}
            >
              {boardCells.map((cell) => {
                const cellKind = renderedBoard[cell.y]?.[cell.x] ?? null;

                return (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "aspect-square rounded-[0.16rem] bg-[var(--tetris-board-cell)] transition-colors",
                      cellKind && tetrominoCellClassNames[cellKind],
                    )}
                    key={`${cell.x}:${cell.y}`}
                  />
                );
              })}
            </div>

            {showStartScreen ? (
              <div
                className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[var(--tetris-board)] px-4 py-5 text-center text-[var(--tetris-board-text)]"
                data-testid="tetris-start-screen"
              >
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="grid grid-cols-6 gap-1"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 30 }, (_, index) => {
                      const x = index % 6;
                      const y = Math.floor(index / 6);
                      const block = START_SCREEN_BLOCKS.find(
                        (candidate) => candidate.x === x && candidate.y === y,
                      );

                      return (
                        <span
                          className={cn(
                            "size-3 rounded-[0.16rem] bg-[var(--tetris-grid)]",
                            block && tetrominoCellClassNames[block.kind],
                          )}
                          key={`${x}:${y}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-3xl font-semibold tracking-normal text-balance">
                      Classic Tetris
                    </p>
                    <p className="text-sm font-medium text-[color-mix(in_oklch,var(--tetris-board-text)_74%,transparent)]">
                      {statusLabels[game.status]}
                    </p>
                  </div>
                </div>
                <Button
                  className="min-w-32"
                  data-testid="tetris-start-button"
                  onClick={startGame}
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
                className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[color-mix(in_oklch,var(--tetris-board)_80%,transparent)] px-4 py-5 text-center text-[var(--tetris-board-text)] backdrop-blur-[2px]"
                data-testid="tetris-game-over-screen"
              >
                <div className="flex flex-col items-center gap-1">
                  <p className="text-3xl font-semibold tracking-normal text-balance">
                    Game over
                  </p>
                  <p className="text-sm font-semibold text-[color-mix(in_oklch,var(--tetris-board-text)_76%,transparent)]">
                    Final score
                  </p>
                  <p className="font-mono text-5xl font-semibold leading-none">
                    {game.score}
                  </p>
                </div>
                <Button
                  className="min-w-36"
                  data-testid="tetris-new-game-button"
                  onClick={restartGame}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  New game
                </Button>
              </div>
            ) : showPauseScreen ? (
              <div
                className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--tetris-board)_72%,transparent)] text-center text-[var(--tetris-board-text)] backdrop-blur-[2px]"
                data-testid="tetris-board-state"
              >
                <div className="flex flex-col items-center gap-3">
                  <p className="text-2xl font-semibold tracking-normal">
                    Paused
                  </p>
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
          </div>

          <div className="flex items-center justify-between rounded-md border border-[var(--tetris-border)] bg-[var(--tetris-panel)] px-3 py-2 text-xs font-medium text-[var(--tetris-muted)]">
            <span>
              Board {TETRIS_BOARD_WIDTH} x {TETRIS_BOARD_HEIGHT}
            </span>
            <span>Speed {tickDelay === null ? "0" : `${Math.round(1000 / tickDelay)}`}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
