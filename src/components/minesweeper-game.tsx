"use client";

import { RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { isTypingTarget } from "@/components/game-input";
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
import { MinesweeperBoard } from "@/components/minesweeper-board";
import { Button } from "@/components/ui/button";
import {
  createInitialMinesweeperGame,
  getMinesweeperRemainingMineCount,
  restartMinesweeperGame,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
  type MinesweeperGameState,
  type MinesweeperStatus,
} from "@/lib/minesweeper-game-engine";
import { cn } from "@/lib/utils";

type MinesweeperGameProps = {
  initialBoardHeight?: number;
  initialBoardWidth?: number;
  initialMineCount?: number;
  onBackToMenu?: () => void;
};

const statusLabels: Record<MinesweeperStatus, string> = {
  lost: "Game over",
  ready: "Ready",
  running: "Running",
  won: "Board cleared",
};

const MINESWEEPER_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [{ text: "Click", label: "Click" }],
        label: "Reveal square",
      },
      {
        buttons: [{ text: "Right click", label: "Right click" }, { text: "M", label: "M key" }],
        label: "Flag square or toggle flag mode",
      },
      {
        buttons: [{ text: "R", label: "R key" }],
        label: "New minefield",
      },
    ],
  },
  {
    title: "Rules",
    items: [
      "Reveal every safe square without revealing a mine.",
      "Numbers show how many mines touch that square.",
      "Use flags to mark suspected mines and track the remaining mine count.",
    ],
  },
];

function createNewMinesweeperGame({
  boardHeight,
  boardWidth,
  mineCount,
}: {
  boardHeight?: number;
  boardWidth?: number;
  mineCount?: number;
} = {}) {
  return createInitialMinesweeperGame({
    height: boardHeight,
    mineCount,
    width: boardWidth,
  });
}

export function MinesweeperGame({
  initialBoardHeight,
  initialBoardWidth,
  initialMineCount,
  onBackToMenu,
}: MinesweeperGameProps = {}) {
  const [game, setGame] = useState<MinesweeperGameState>(() =>
    createNewMinesweeperGame({
      boardHeight: initialBoardHeight,
      boardWidth: initialBoardWidth,
      mineCount: initialMineCount,
    }),
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFlagMode, setIsFlagMode] = useState(false);
  const safeCellCount = game.width * game.height - game.mineCount;
  const remainingMineCount = getMinesweeperRemainingMineCount(game);
  const showEndScreen = game.status === "lost" || game.status === "won";
  const { closeHelp, isHelpVisible, openHelp } = useGameHelpScreen();
  const { abandonDialogProps, requestBackToMenu } = useGameEscapeToMenu({
    isDisabled: isHelpVisible,
    isGameStarted: game.status === "running",
    onBackToMenu,
  });

  const revealCell = useCallback((cellId: string) => {
    setGame((current) => revealMinesweeperCell(current, cellId, { random: Math.random }));
  }, []);

  const toggleFlag = useCallback((cellId: string) => {
    setGame((current) => toggleMinesweeperFlag(current, cellId));
  }, []);

  const startNewGame = useCallback(() => {
    setElapsedSeconds(0);
    setIsFlagMode(false);
    setGame((current) => restartMinesweeperGame(current));
  }, []);

  useEffect(() => {
    if (game.status !== "running" || isHelpVisible) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [game.status, isHelpVisible]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isHelpVisible || isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        startNewGame();
        return;
      }

      if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        setIsFlagMode((current) => !current);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHelpVisible, startNewGame]);

  return (
    <GameShell className="bg-[var(--minesweeper-page)] text-[var(--minesweeper-ink)]">
      <GameSidebar className="border-[var(--minesweeper-border)] bg-[var(--minesweeper-panel)]">
        <GameHeader
          accentClassName="bg-[linear-gradient(90deg,var(--minesweeper-flag),var(--minesweeper-one),var(--minesweeper-two))]"
          status={statusLabels[game.status]}
          statusClassName="text-[var(--minesweeper-muted)]"
          statusTestId="minesweeper-status"
          title="Classic Minesweeper"
        />

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[var(--minesweeper-border)] p-3">
            <dt className="text-xs font-medium text-[var(--minesweeper-muted)]">Mines</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="minesweeper-mines-remaining"
            >
              {remainingMineCount}
            </dd>
          </div>
          <div className="rounded-md border border-[var(--minesweeper-border)] p-3">
            <dt className="text-xs font-medium text-[var(--minesweeper-muted)]">Time</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="minesweeper-time"
            >
              {formatElapsedTime(elapsedSeconds)}
            </dd>
          </div>
        </dl>

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[var(--minesweeper-border)] p-3">
            <dt className="text-xs font-medium text-[var(--minesweeper-muted)]">Safe cells</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="minesweeper-safe-cells"
            >
              {game.revealedSafeCellCount}/{safeCellCount}
            </dd>
          </div>
          <div className="rounded-md border border-[var(--minesweeper-border)] p-3">
            <dt className="text-xs font-medium text-[var(--minesweeper-muted)]">Mode</dt>
            <dd
              className={cn(
                "mt-1 inline-flex rounded-[0.2rem] px-2 py-1 text-sm font-semibold",
                isFlagMode
                  ? "bg-[color-mix(in_oklch,var(--minesweeper-flag)_14%,white)] text-[var(--minesweeper-flag)]"
                  : "bg-[color-mix(in_oklch,var(--minesweeper-one)_14%,white)] text-[var(--minesweeper-one)]",
              )}
              data-testid="minesweeper-active-mode"
            >
              {isFlagMode ? "Flag" : "Reveal"}
            </dd>
          </div>
        </dl>

      </GameSidebar>

      <GameBoardColumn className="max-w-[min(92vw,37.25rem)]">
        <GameBoardStage
          actions={
            <GameBoardActions
              backDisabled={isHelpVisible}
              helpDisabled={isHelpVisible}
              onBackToMenu={requestBackToMenu}
              onHelp={openHelp}
              onRestart={startNewGame}
              testIdPrefix="minesweeper"
            />
          }
        >
          <MinesweeperBoard
            game={game}
            isFlagMode={isFlagMode}
            onRevealCell={revealCell}
            onToggleFlag={toggleFlag}
            statusLabel={statusLabels[game.status]}
          >
          {showEndScreen ? (
            <div
              className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[color-mix(in_oklch,var(--minesweeper-board)_76%,transparent)] px-4 py-5 text-center text-[var(--minesweeper-board-text)] backdrop-blur-[2px]"
              data-testid="minesweeper-end-screen"
            >
              <div className="flex flex-col items-center gap-1">
                <p className="text-3xl font-semibold tracking-normal text-balance">
                  {game.status === "won" ? "Board cleared" : "Game over"}
                </p>
                <p className="text-sm font-semibold text-[color-mix(in_oklch,var(--minesweeper-board-text)_76%,transparent)]">
                  Time
                </p>
                <p className="font-mono text-5xl font-semibold leading-none">
                  {formatElapsedTime(elapsedSeconds)}
                </p>
              </div>
              <Button
                className="min-w-36"
                onClick={startNewGame}
                size="lg"
                type="button"
                variant="secondary"
              >
                <RotateCcwIcon data-icon="inline-start" />
                New game
              </Button>
            </div>
          ) : null}
          {isHelpVisible ? (
            <GameHelpScreen
              className="border-[color-mix(in_oklch,var(--minesweeper-board-text)_24%,transparent)] bg-[color-mix(in_oklch,var(--minesweeper-mine)_92%,black)] text-[var(--minesweeper-board-text)]"
              onClose={closeHelp}
              sections={MINESWEEPER_HELP_SECTIONS}
              testId="minesweeper-help-screen"
              title="Classic Minesweeper"
            />
          ) : null}
          </MinesweeperBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}

function formatElapsedTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
