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
import { GameLeaderboardPanel, GameLeaderboardScoreForm } from "@/components/game-leaderboard";
import { TwentyFortyEightBoard } from "@/components/twenty-forty-eight-board";
import { Button } from "@/components/ui/button";
import {
  createInitialTwentyFortyEightGame,
  getTwentyFortyEightTopTile,
  moveTwentyFortyEightGame,
  restartTwentyFortyEightGame,
  startTwentyFortyEightGame,
  type TwentyFortyEightDirection,
  type TwentyFortyEightGameState,
  type TwentyFortyEightStatus,
} from "@/lib/twenty-forty-eight-game-engine";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";
import { useGameLeaderboard } from "@/hooks/use-game-leaderboard";

type TwentyFortyEightGameProps = {
  initialBoardSize?: number;
  initialWinTile?: number;
  onBackToMenu?: () => void;
};

const statusLabels: Record<Exclude<TwentyFortyEightStatus, "won">, string> = {
  lost: "No moves left",
  ready: "Ready",
  running: "Running",
};

function createTwentyFortyEightHelpSections(winTile: number): GameHelpSection[] {
  return [
    {
      title: "Controls",
      controls: [
        {
          buttons: [{ text: "Enter", label: "Enter key" }],
          label: "Start game",
        },
        {
          buttons: [{ icon: ArrowUpIcon, label: "Up" }, { text: "W", label: "W key" }],
          label: "Slide up",
        },
        {
          buttons: [{ icon: ArrowLeftIcon, label: "Left" }, { text: "A", label: "A key" }],
          label: "Slide left",
        },
        {
          buttons: [{ icon: ArrowDownIcon, label: "Down" }, { text: "S", label: "S key" }],
          label: "Slide down",
        },
        {
          buttons: [{ icon: ArrowRightIcon, label: "Right" }, { text: "D", label: "D key" }],
          label: "Slide right",
        },
        {
          buttons: [{ text: "R", label: "R key" }],
          label: "New board",
        },
      ],
    },
    {
      title: "Rules",
      items: [
        "Tiles slide as far as possible in the chosen direction.",
        "Matching tiles merge once per move and add to your score.",
        `Reach ${winTile} to win; the game ends when no moves remain.`,
      ],
    },
  ];
}

function getTwentyFortyEightStatusLabel(game: TwentyFortyEightGameState) {
  return game.status === "won" ? `${game.winTile} reached` : statusLabels[game.status];
}

function createNewTwentyFortyEightGame({
  boardSize,
  winTile,
}: {
  boardSize?: number;
  winTile?: number;
} = {}) {
  return createInitialTwentyFortyEightGame({
    boardSize,
    random: Math.random,
    winTile,
  });
}

export function TwentyFortyEightGame({
  initialBoardSize,
  initialWinTile,
  onBackToMenu,
}: TwentyFortyEightGameProps = {}) {
  const [game, setGame] = useState<TwentyFortyEightGameState>(() =>
    createNewTwentyFortyEightGame({
      boardSize: initialBoardSize,
      winTile: initialWinTile,
    }),
  );
  const statusLabel = getTwentyFortyEightStatusLabel(game);
  const helpSections = useMemo(
    () => createTwentyFortyEightHelpSections(game.winTile),
    [game.winTile],
  );
  const topTile = getTwentyFortyEightTopTile(game);
  const showStartScreen = game.status === "ready";
  const showEndScreen = game.status === "lost" || game.status === "won";
  const leaderboardKey = createGameLeaderboardKey("twenty-forty-eight", [
    { name: "board", value: game.boardSize },
    { name: "goal", value: game.winTile },
  ]);
  const {
    isSavingLeaderboardScore,
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
    pendingScore: showEndScreen ? game.score : null,
  });
  const bestScore = Math.max(game.bestScore, leaderboardBestScore);
  const { closeHelp, isHelpVisible, openHelp } = useGameHelpScreen();
  const { abandonDialogProps, requestBackToMenu } = useGameEscapeToMenu({
    isDisabled: isHelpVisible,
    isGameStarted: game.status === "running",
    onBackToMenu,
  });

  const startGame = useCallback(() => {
    resetLeaderboardForm();
    setGame((current) => startTwentyFortyEightGame(current));
  }, [resetLeaderboardForm]);

  const restartGame = useCallback(() => {
    resetLeaderboardForm();
    setGame((current) => restartTwentyFortyEightGame(current, { random: Math.random }));
  }, [resetLeaderboardForm]);

  const moveTiles = useCallback((direction: TwentyFortyEightDirection) => {
    setGame((current) => moveTwentyFortyEightGame(current, direction, { random: Math.random }));
  }, []);

  const saveLeaderboardScore = useCallback(() => {
    void savePendingLeaderboardScore();
  }, [savePendingLeaderboardScore]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isHelpVisible || pendingLeaderboardEntry !== null || isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "Enter" && game.status === "ready") {
        event.preventDefault();
        startGame();
        return;
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        restartGame();
        return;
      }

      const direction = getDirectionForKey(event.key);

      if (direction === null) {
        return;
      }

      event.preventDefault();
      moveTiles(direction);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game.status, isHelpVisible, moveTiles, pendingLeaderboardEntry, restartGame, startGame]);

  return (
    <GameShell className="bg-[var(--twenty-page)] text-[var(--twenty-ink)]">
      <GameSidebar className="border-[var(--twenty-border)] bg-[var(--twenty-panel)]">
        <GameHeader
          accentClassName="bg-[linear-gradient(90deg,var(--twenty-tile-8),var(--twenty-tile-128),var(--twenty-tile-2048))]"
          status={statusLabel}
          statusClassName="text-[var(--twenty-muted)]"
          statusTestId="twenty-forty-eight-status"
          title="Classic 2048"
        />

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[var(--twenty-border)] p-3">
            <dt className="text-xs font-medium text-[var(--twenty-muted)]">Score</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="twenty-forty-eight-score"
            >
              {game.score}
            </dd>
          </div>
          <div className="rounded-md border border-[var(--twenty-border)] p-3">
            <dt className="text-xs font-medium text-[var(--twenty-muted)]">Best</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="twenty-forty-eight-best-score"
            >
              {bestScore}
            </dd>
          </div>
        </dl>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[var(--twenty-border)] p-3">
            <p className="text-xs font-medium text-[var(--twenty-muted)]">Top tile</p>
            <p
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="twenty-forty-eight-top-tile"
            >
              {topTile}
            </p>
          </div>
          <div className="rounded-md border border-[var(--twenty-border)] p-3">
            <p className="text-xs font-medium text-[var(--twenty-muted)]">Moves</p>
            <p
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="twenty-forty-eight-moves"
            >
              {game.moveCount}
            </p>
          </div>
        </div>

      </GameSidebar>

      <GameBoardColumn className="max-w-[min(92vw,37.25rem)]">
        <GameBoardStage
          actions={
            <GameBoardActions
              backDisabled={isHelpVisible}
              helpDisabled={isHelpVisible}
              onBackToMenu={requestBackToMenu}
              onHelp={openHelp}
              onRestart={restartGame}
              restartDisabled={pendingLeaderboardEntry !== null}
              testIdPrefix="twenty-forty-eight"
            />
          }
        >
          <TwentyFortyEightBoard game={game} statusLabel={statusLabel}>
          {showStartScreen ? (
            <div
              className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[var(--twenty-board)] px-4 py-5 text-center text-[var(--twenty-board-text)]"
              data-testid="twenty-forty-eight-start-screen"
            >
              <div className="flex flex-col items-center gap-3">
                <StartPreview />
                <div className="flex flex-col items-center gap-1">
                  <p className="text-3xl font-semibold tracking-normal text-balance">
                    Classic 2048
                  </p>
                  <p className="text-sm font-medium text-[color-mix(in_oklch,var(--twenty-board-text)_74%,transparent)]">
                    {statusLabel}
                  </p>
                </div>
              </div>
              <Button
                className="min-w-32"
                data-testid="twenty-forty-eight-overlay-start-button"
                onClick={startGame}
                size="lg"
                type="button"
                variant="secondary"
              >
                <PlayIcon data-icon="inline-start" />
                Start
              </Button>
              <GameLeaderboardPanel
                slotTestIdPrefix="twenty-forty-eight-leaderboard-slot"
                slots={leaderboardSlots}
                statusMessage={leaderboardStatusMessage}
                testId="twenty-forty-eight-start-leaderboard"
              />
            </div>
          ) : showEndScreen ? (
            <div
              className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[color-mix(in_oklch,var(--twenty-board)_78%,transparent)] px-4 py-5 text-center text-[var(--twenty-board-text)] backdrop-blur-[2px]"
              data-testid="twenty-forty-eight-end-screen"
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
                    testIdPrefix="twenty-forty-eight"
                  />
                  <GameLeaderboardPanel
                    slotTestIdPrefix="twenty-forty-eight-final-leaderboard-slot"
                    slots={leaderboardSlots}
                    statusMessage={leaderboardStatusMessage}
                    testId="twenty-forty-eight-final-leaderboard"
                  />
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-3xl font-semibold tracking-normal text-balance">
                      {game.status === "won" ? `${game.winTile} reached` : "No moves left"}
                    </p>
                    <p className="text-sm font-semibold text-[color-mix(in_oklch,var(--twenty-board-text)_76%,transparent)]">
                      Final score
                    </p>
                    <p className="font-mono text-5xl font-semibold leading-none">{game.score}</p>
                  </div>
                  <GameLeaderboardPanel
                    slotTestIdPrefix="twenty-forty-eight-final-leaderboard-slot"
                    slots={leaderboardSlots}
                    statusMessage={leaderboardStatusMessage}
                    testId="twenty-forty-eight-final-leaderboard"
                  />
                  <Button
                    className="min-w-36"
                    data-testid="twenty-forty-eight-overlay-new-game-button"
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
          ) : null}
          {isHelpVisible ? (
            <GameHelpScreen
              className="border-[color-mix(in_oklch,var(--twenty-board-text)_24%,transparent)] bg-[color-mix(in_oklch,var(--twenty-board)_94%,black)] text-[var(--twenty-board-text)]"
              onClose={closeHelp}
              sections={helpSections}
              testId="twenty-forty-eight-help-screen"
              title="Classic 2048"
            />
          ) : null}
          </TwentyFortyEightBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}

function getDirectionForKey(key: string): TwentyFortyEightDirection | null {
  if (key === "ArrowUp" || key === "w" || key === "W") {
    return "up";
  }

  if (key === "ArrowDown" || key === "s" || key === "S") {
    return "down";
  }

  if (key === "ArrowLeft" || key === "a" || key === "A") {
    return "left";
  }

  if (key === "ArrowRight" || key === "d" || key === "D") {
    return "right";
  }

  return null;
}

function StartPreview() {
  const previewTiles = new Map([
    ["0:0", 2],
    ["1:0", 4],
    ["2:1", 8],
    ["3:2", 16],
    ["1:3", 32],
  ]);

  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-4 gap-1.5 rounded-md bg-[var(--twenty-grid)] p-1.5"
    >
      {Array.from({ length: 16 }, (_, index) => {
        const x = index % 4;
        const y = Math.floor(index / 4);
        const value = previewTiles.get(`${x}:${y}`);

        return (
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-[0.2rem] bg-[var(--twenty-empty)] font-mono text-sm font-black",
              value === 2 && "bg-[var(--twenty-tile-2)] text-[var(--twenty-tile-dark)]",
              value === 4 && "bg-[var(--twenty-tile-4)] text-[var(--twenty-tile-dark)]",
              value === 8 && "bg-[var(--twenty-tile-8)] text-[var(--twenty-tile-light)]",
              value === 16 && "bg-[var(--twenty-tile-16)] text-[var(--twenty-tile-light)]",
              value === 32 && "bg-[var(--twenty-tile-32)] text-[var(--twenty-tile-light)]",
            )}
            key={`${x}:${y}`}
          >
            {value}
          </span>
        );
      })}
    </div>
  );
}
