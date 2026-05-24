"use client";

import { RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { registerGameKeyDown, shouldIgnoreGameKeyDown } from "@/components/game-input";
import {
  GameAbandonDialog,
  GameBoardActions,
  GameBoardColumn,
  GameBoardStage,
  GameEndScreen,
  GameEndSummary,
  GameHeader,
  GameHelpScreen,
  GameShell,
  GameSidebar,
  GameStatCard,
  useGameEscapeToMenu,
  useGameHelpScreen,
  type GameHelpSection,
} from "@/components/game-layout";
import { GameLeaderboardPanel, GameLeaderboardScoreForm } from "@/components/game-leaderboard";
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
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";
import { useGameLeaderboard } from "@/hooks/use-game-leaderboard";

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
  const leaderboardKey = createGameLeaderboardKey("minesweeper", [
    { name: "board", value: `${game.width}x${game.height}` },
    { name: "mines", value: game.mineCount },
  ]);
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
    leaderboardKey,
    pendingScore: game.status === "won" ? elapsedSeconds : null,
    sortDirection: "asc",
  });
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
    resetLeaderboardForm();
    setElapsedSeconds(0);
    setIsFlagMode(false);
    setGame((current) => restartMinesweeperGame(current));
  }, [resetLeaderboardForm]);

  const saveLeaderboardScore = useCallback(() => {
    void savePendingLeaderboardScore();
  }, [savePendingLeaderboardScore]);

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
      if (
        shouldIgnoreGameKeyDown(event, {
          hasPendingLeaderboardEntry: pendingLeaderboardEntry !== null,
          isHelpVisible,
        })
      ) {
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

    return registerGameKeyDown(handleKeyDown);
  }, [isHelpVisible, pendingLeaderboardEntry, startNewGame]);

  return (
    <GameShell className="bg-[var(--minesweeper-page)] text-[var(--minesweeper-ink)]">
      <GameSidebar className="border-[var(--minesweeper-border)] bg-[var(--minesweeper-panel)]">
        <GameHeader
          status={statusLabels[game.status]}
          statusTestId="minesweeper-status"
          title="Classic Minesweeper"
        />

        <dl className="grid grid-cols-2 gap-3">
          <GameStatCard
            className="border-[var(--minesweeper-border)]"
            label="Mines"
            labelClassName="text-[var(--minesweeper-muted)]"
            value={remainingMineCount}
            valueTestId="minesweeper-mines-remaining"
          />
          <GameStatCard
            className="border-[var(--minesweeper-border)]"
            label="Time"
            labelClassName="text-[var(--minesweeper-muted)]"
            value={formatElapsedTime(elapsedSeconds)}
            valueTestId="minesweeper-time"
          />
        </dl>

        <dl className="grid grid-cols-2 gap-3">
          <GameStatCard
            className="border-[var(--minesweeper-border)]"
            label="Safe cells"
            labelClassName="text-[var(--minesweeper-muted)]"
            value={`${game.revealedSafeCellCount}/${safeCellCount}`}
            valueTestId="minesweeper-safe-cells"
          />
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

      <GameBoardColumn className="w-[min(92vw,37.25rem)]">
        <GameBoardStage
          actions={
            <GameBoardActions
              backDisabled={isHelpVisible}
              helpDisabled={isHelpVisible}
              onBackToMenu={requestBackToMenu}
              onHelp={openHelp}
              onRestart={startNewGame}
              restartDisabled={pendingLeaderboardEntry !== null}
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
            <GameEndScreen testId="minesweeper-end-screen">
              {pendingLeaderboardEntry ? (
                <>
                  <GameLeaderboardScoreForm
                    formatScore={formatElapsedTime}
                    isSaving={isSavingLeaderboardScore}
                    onPlayerNameChange={setPlayerName}
                    onSaveScore={saveLeaderboardScore}
                    pendingEntry={pendingLeaderboardEntry}
                    playerName={playerName}
                    saveFailed={scoreSaveFailed}
                    scoreLabel="time"
                    testIdPrefix="minesweeper"
                  />
                  <GameLeaderboardPanel
                    formatScore={formatElapsedTime}
                    slotTestIdPrefix="minesweeper-final-leaderboard-slot"
                    slots={leaderboardSlots}
                    statusMessage={leaderboardStatusMessage}
                    testId="minesweeper-final-leaderboard"
                  />
                </>
              ) : (
                <>
                  <GameEndSummary
                    metricLabel="Time"
                    metricValue={formatElapsedTime(elapsedSeconds)}
                    metricValueTestId="minesweeper-final-time"
                    title={game.status === "won" ? "Board cleared" : "Game over"}
                  />
                  <GameLeaderboardPanel
                    formatScore={formatElapsedTime}
                    slotTestIdPrefix="minesweeper-final-leaderboard-slot"
                    slots={leaderboardSlots}
                    statusMessage={leaderboardStatusMessage}
                    testId="minesweeper-final-leaderboard"
                  />
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
                </>
              )}
            </GameEndScreen>
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
