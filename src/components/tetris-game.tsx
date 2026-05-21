"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import { isTypingTarget } from "@/components/game-input";
import { TetrisBoard, tetrominoCellClassNames } from "@/components/tetris-board";
import { Button } from "@/components/ui/button";
import {
  advanceTetrisGame,
  createInitialTetrisGame,
  getTetrominoPreviewCells,
  getTetrisTickDelay,
  hardDropTetrisPiece,
  moveTetrisPiece,
  pauseTetrisGame,
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

const TETRIS_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [{ text: "Enter", label: "Enter key" }],
        label: "Start game",
      },
      {
        buttons: [{ icon: ArrowLeftIcon, label: "Left" }, { text: "A", label: "A key" }],
        label: "Move left",
      },
      {
        buttons: [{ icon: ArrowRightIcon, label: "Right" }, { text: "D", label: "D key" }],
        label: "Move right",
      },
      {
        buttons: [{ icon: ArrowDownIcon, label: "Down" }, { text: "S", label: "S key" }],
        label: "Soft drop",
      },
      {
        buttons: [{ text: "Space", label: "Space key" }],
        label: "Hard drop",
      },
      {
        buttons: [
          { icon: ArrowUpIcon, label: "Up" },
          { text: "W", label: "W key" },
          { text: "X", label: "X key" },
        ],
        label: "Rotate clockwise",
      },
      {
        buttons: [{ text: "Z", label: "Z key" }],
        label: "Rotate counterclockwise",
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
      "Fit falling pieces into complete horizontal lines.",
      "Cleared lines score points and raise the level over time.",
      "The game ends when a new piece cannot enter the board.",
    ],
  },
];

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

const TETRIS_PREVIEW_CANVAS_CELLS = 4;
const TETRIS_PREVIEW_GAP_PERCENT = 3;
const TETRIS_PREVIEW_CELL_SIZE_PERCENT =
  (100 - TETRIS_PREVIEW_GAP_PERCENT * (TETRIS_PREVIEW_CANVAS_CELLS - 1)) /
  TETRIS_PREVIEW_CANVAS_CELLS;

type TetrisPreviewBlock = {
  key: string;
  leftPercent: number;
  topPercent: number;
};

function createRunningTetrisGame() {
  return {
    ...createInitialTetrisGame({ random: Math.random }),
    status: "running" as const,
  };
}

function createCenteredPreviewBlocks(kind: TetrominoKind): TetrisPreviewBlock[] {
  const cells = getTetrominoPreviewCells(kind);
  const minX = Math.min(...cells.map((cell) => cell.x));
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  const maxY = Math.max(...cells.map((cell) => cell.y));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const widthPercent =
    width * TETRIS_PREVIEW_CELL_SIZE_PERCENT + (width - 1) * TETRIS_PREVIEW_GAP_PERCENT;
  const heightPercent =
    height * TETRIS_PREVIEW_CELL_SIZE_PERCENT + (height - 1) * TETRIS_PREVIEW_GAP_PERCENT;
  const offsetXPercent = (100 - widthPercent) / 2;
  const offsetYPercent = (100 - heightPercent) / 2;
  const stepPercent = TETRIS_PREVIEW_CELL_SIZE_PERCENT + TETRIS_PREVIEW_GAP_PERCENT;

  return cells.map((cell) => {
    const x = cell.x - minX;
    const y = cell.y - minY;

    return {
      key: `${x}:${y}`,
      leftPercent: offsetXPercent + x * stepPercent,
      topPercent: offsetYPercent + y * stepPercent,
    };
  });
}

export function TetrisGame({ onBackToMenu }: TetrisGameProps = {}) {
  const [game, setGame] = useState<TetrisGameState>(() => createInitialTetrisGame());
  const nextPreviewBlocks = useMemo(
    () => createCenteredPreviewBlocks(game.nextPieceKind),
    [game.nextPieceKind],
  );
  const tickDelay = game.status === "running" ? getTetrisTickDelay(game.level) : null;
  const canPauseGame = game.status === "running" || game.status === "paused";
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const showStartScreen = game.status === "ready";
  const showGameOverScreen = game.status === "lost";
  const showPauseScreen = game.status === "paused";

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

  const pauseGameForHelp = useCallback(() => {
    setGame((current) => pauseTetrisGame(current));
  }, []);

  const resumeGameAfterHelp = useCallback(() => {
    setGame((current) => startTetrisGame(current, { random: Math.random }));
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

    const tick = window.setInterval(advanceTetris, tickDelay);

    return () => window.clearInterval(tick);
  }, [advanceTetris, tickDelay]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isHelpVisible || isTypingTarget(event.target)) {
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
    isHelpVisible,
    startGame,
    toggleRunState,
  ]);

  return (
    <GameShell className="bg-[var(--tetris-page)] text-[var(--tetris-ink)]">
      <GameSidebar className="border-[var(--tetris-border)] bg-[var(--tetris-panel)]">
        <GameHeader
          accentClassName="bg-[linear-gradient(90deg,var(--tetris-cyan),var(--tetris-yellow),var(--tetris-purple))]"
          status={statusLabels[game.status]}
          statusClassName="text-[var(--tetris-muted)]"
          statusTestId="tetris-status"
          title="Classic Tetris"
        />

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
                className="relative aspect-square overflow-hidden rounded-[0.375rem] bg-[var(--tetris-board)] p-1"
                data-testid="tetris-next-piece"
                role="img"
              >
                <div aria-hidden="true" className="relative size-full">
                  {nextPreviewBlocks.map((block) => (
                    <span
                      className={cn(
                        "absolute rounded-[0.16rem]",
                        tetrominoCellClassNames[game.nextPieceKind],
                      )}
                      key={block.key}
                      style={{
                        height: `${TETRIS_PREVIEW_CELL_SIZE_PERCENT}%`,
                        left: `${block.leftPercent}%`,
                        top: `${block.topPercent}%`,
                        width: `${TETRIS_PREVIEW_CELL_SIZE_PERCENT}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

      </GameSidebar>

      <GameBoardColumn className="max-w-[min(86vw,22.25rem)]">
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
              restartDisabled={game.status === "ready"}
              testIdPrefix="tetris"
            />
          }
        >
          <TetrisBoard game={game} statusLabel={statusLabels[game.status]}>
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
            {isHelpVisible ? (
              <GameHelpScreen
                className="border-[color-mix(in_oklch,var(--tetris-board-text)_24%,transparent)] bg-[color-mix(in_oklch,var(--tetris-board)_94%,black)] text-[var(--tetris-board-text)]"
                onClose={closeHelp}
                sections={TETRIS_HELP_SECTIONS}
                testId="tetris-help-screen"
                title="Classic Tetris"
              />
            ) : null}
          </TetrisBoard>
        </GameBoardStage>

          <div className="flex items-center justify-between rounded-md border border-[var(--tetris-border)] bg-[var(--tetris-panel)] px-3 py-2 text-xs font-medium text-[var(--tetris-muted)]">
            <span>
              Board {TETRIS_BOARD_WIDTH} x {TETRIS_BOARD_HEIGHT}
            </span>
            <span>Speed {tickDelay === null ? "0" : `${Math.round(1000 / tickDelay)}`}</span>
          </div>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}
