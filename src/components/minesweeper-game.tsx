"use client";

import { PlayIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { registerGameKeyDown, shouldIgnoreGameKeyDown } from "@/components/game-input";
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
  GameStatCard,
  useGameEscapeToMenu,
  useGameHelpScreen,
  type GameHelpSection,
} from "@/components/game-layout";
import { GameLeaderboardPanel } from "@/components/game-leaderboard";
import { MinesweeperBoard, MinesweeperStartPreview } from "@/components/minesweeper-board";
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
        buttons: [{ text: "Enter", label: "Enter key" }],
        label: "Start board",
      },
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
  const [isStartScreenVisible, setIsStartScreenVisible] = useState(true);
  const safeCellCount = game.width * game.height - game.mineCount;
  const remainingMineCount = getMinesweeperRemainingMineCount(game);
  const showStartScreen = isStartScreenVisible && game.status === "ready";
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

  const startGame = useCallback(() => {
    resetLeaderboardForm();
    setIsStartScreenVisible(false);
  }, [resetLeaderboardForm]);

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
    setIsStartScreenVisible(true);
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

      if (event.key === "Enter" && showStartScreen) {
        event.preventDefault();
        startGame();
        return;
      }

      if (showStartScreen) {
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
  }, [isHelpVisible, pendingLeaderboardEntry, showStartScreen, startGame, startNewGame]);

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
            isInputDisabled={showStartScreen}
            isFlagMode={isFlagMode}
            onRevealCell={revealCell}
            onToggleFlag={toggleFlag}
            statusLabel={statusLabels[game.status]}
          >
            {showStartScreen ? (
              <div
                className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[var(--minesweeper-board)] px-4 py-5 text-center text-[var(--minesweeper-board-text)]"
                data-testid="minesweeper-start-screen"
              >
                <div className="flex flex-col items-center gap-3">
                  <MinesweeperStartPreview />
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-3xl font-semibold tracking-normal text-balance">
                      Classic Minesweeper
                    </p>
                    <p className="text-sm font-medium text-[color-mix(in_oklch,var(--minesweeper-board-text)_74%,transparent)]">
                      {statusLabels[game.status]}
                    </p>
                  </div>
                </div>
                <Button
                  className="min-w-32"
                  data-testid="minesweeper-start-button"
                  onClick={startGame}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <PlayIcon data-icon="inline-start" />
                  Start
                </Button>
                <GameLeaderboardPanel
                  formatScore={formatElapsedTime}
                  slotTestIdPrefix="minesweeper-leaderboard-slot"
                  slots={leaderboardSlots}
                  statusMessage={leaderboardStatusMessage}
                  testId="minesweeper-start-leaderboard"
                />
              </div>
            ) : showEndScreen ? (
              <GameEndScreen testId="minesweeper-end-screen">
                <GameEndLeaderboardContent
                  action={
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
                  }
                  leaderboard={{
                    formatScore: formatElapsedTime,
                    slotTestIdPrefix: "minesweeper-final-leaderboard-slot",
                    slots: leaderboardSlots,
                    statusMessage: leaderboardStatusMessage,
                    testId: "minesweeper-final-leaderboard",
                  }}
                  pendingLeaderboardEntry={pendingLeaderboardEntry}
                  scoreForm={{
                    formatScore: formatElapsedTime,
                    isSaving: isSavingLeaderboardScore,
                    onPlayerNameChange: setPlayerName,
                    onSaveScore: saveLeaderboardScore,
                    playerName,
                    saveFailed: scoreSaveFailed,
                    scoreLabel: "time",
                    testIdPrefix: "minesweeper",
                  }}
                  summary={{
                    metricLabel: "Time",
                    metricValue: formatElapsedTime(elapsedSeconds),
                    metricValueTestId: "minesweeper-final-time",
                    title: game.status === "won" ? "Board cleared" : "Game over",
                  }}
                />
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
