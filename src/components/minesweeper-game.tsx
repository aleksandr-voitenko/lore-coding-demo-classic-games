"use client";

import { FlagIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { isTypingTarget } from "@/components/game-input";
import { GameBoardColumn, GameHeader, GameShell, GameSidebar } from "@/components/game-layout";
import { MinesweeperBoard, minesweeperBoardSizeLabel } from "@/components/minesweeper-board";
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
  onBackToMenu?: () => void;
};

const statusLabels: Record<MinesweeperStatus, string> = {
  lost: "Game over",
  ready: "Ready",
  running: "Running",
  won: "Board cleared",
};

function createNewMinesweeperGame() {
  return createInitialMinesweeperGame();
}

export function MinesweeperGame({ onBackToMenu }: MinesweeperGameProps = {}) {
  const [game, setGame] = useState<MinesweeperGameState>(() => createNewMinesweeperGame());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFlagMode, setIsFlagMode] = useState(false);
  const safeCellCount = game.width * game.height - game.mineCount;
  const remainingMineCount = getMinesweeperRemainingMineCount(game);
  const showEndScreen = game.status === "lost" || game.status === "won";

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
    if (game.status !== "running") {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [game.status]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
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
  }, [startNewGame]);

  return (
    <GameShell className="bg-[var(--minesweeper-page)] text-[var(--minesweeper-ink)]">
      <GameSidebar className="border-[var(--minesweeper-border)] bg-[var(--minesweeper-panel)]">
        <GameHeader
          accentClassName="bg-[linear-gradient(90deg,var(--minesweeper-flag),var(--minesweeper-one),var(--minesweeper-two))]"
          backButtonTestId="minesweeper-back-to-menu"
          onBackToMenu={onBackToMenu}
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

        <div className="rounded-md border border-[var(--minesweeper-border)] p-3">
          <p className="text-xs font-medium text-[var(--minesweeper-muted)]">Safe cells</p>
          <p
            className="font-mono text-3xl font-semibold leading-none"
            data-testid="minesweeper-safe-cells"
          >
            {game.revealedSafeCellCount}/{safeCellCount}
          </p>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
          <div
            className="grid grid-cols-2 gap-2"
            data-testid="minesweeper-mode-controls"
          >
            <Button
              aria-pressed={!isFlagMode}
              data-testid="minesweeper-reveal-mode"
              onClick={() => setIsFlagMode(false)}
              type="button"
              variant={isFlagMode ? "outline" : "default"}
            >
              <SearchIcon data-icon="inline-start" />
              Reveal
            </Button>
            <Button
              aria-pressed={isFlagMode}
              data-testid="minesweeper-flag-mode"
              onClick={() => setIsFlagMode(true)}
              type="button"
              variant={isFlagMode ? "default" : "outline"}
            >
              <FlagIcon data-icon="inline-start" />
              Flag
            </Button>
          </div>

          <Button
            data-testid="minesweeper-new-game-button"
            onClick={startNewGame}
            type="button"
            variant="outline"
          >
            <RotateCcwIcon data-icon="inline-start" />
            New game
          </Button>
        </div>
      </GameSidebar>

      <GameBoardColumn className="max-w-[min(92vw,34rem)]">
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
        </MinesweeperBoard>

        <div className="flex items-center justify-between rounded-md border border-[var(--minesweeper-border)] bg-[var(--minesweeper-panel)] px-3 py-2 text-xs font-medium text-[var(--minesweeper-muted)]">
          <span>Board {minesweeperBoardSizeLabel}</span>
          <span
            className={cn(
              "rounded-[0.2rem] px-2 py-1 font-semibold",
              isFlagMode
                ? "bg-[color-mix(in_oklch,var(--minesweeper-flag)_14%,white)] text-[var(--minesweeper-flag)]"
                : "bg-[color-mix(in_oklch,var(--minesweeper-one)_14%,white)] text-[var(--minesweeper-one)]",
            )}
            data-testid="minesweeper-active-mode"
          >
            {isFlagMode ? "Flag" : "Reveal"}
          </span>
        </div>
      </GameBoardColumn>
    </GameShell>
  );
}

function formatElapsedTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
