"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { isTypingTarget } from "@/components/game-input";
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
import {
  TwentyFortyEightBoard,
  twentyFortyEightBoardSizeLabel,
} from "@/components/twenty-forty-eight-board";
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
import { cn } from "@/lib/utils";

type TwentyFortyEightGameProps = {
  onBackToMenu?: () => void;
};

const statusLabels: Record<TwentyFortyEightStatus, string> = {
  lost: "No moves left",
  ready: "Ready",
  running: "Running",
  won: "2048 reached",
};

const TWENTY_FORTY_EIGHT_HELP_SECTIONS: GameHelpSection[] = [
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
      "Reach 2048 to win; the game ends when no moves remain.",
    ],
  },
];

function createNewTwentyFortyEightGame() {
  return createInitialTwentyFortyEightGame({ random: Math.random });
}

export function TwentyFortyEightGame({ onBackToMenu }: TwentyFortyEightGameProps = {}) {
  const [game, setGame] = useState<TwentyFortyEightGameState>(() =>
    createNewTwentyFortyEightGame(),
  );
  const topTile = getTwentyFortyEightTopTile(game);
  const showStartScreen = game.status === "ready";
  const showEndScreen = game.status === "lost" || game.status === "won";
  const { closeHelp, isHelpVisible, openHelp } = useGameHelpScreen();

  const startGame = useCallback(() => {
    setGame((current) => startTwentyFortyEightGame(current));
  }, []);

  const restartGame = useCallback(() => {
    setGame((current) => restartTwentyFortyEightGame(current, { random: Math.random }));
  }, []);

  const moveTiles = useCallback((direction: TwentyFortyEightDirection) => {
    setGame((current) => moveTwentyFortyEightGame(current, direction, { random: Math.random }));
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isHelpVisible || isTypingTarget(event.target)) {
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
  }, [game.status, isHelpVisible, moveTiles, restartGame, startGame]);

  return (
    <GameShell className="bg-[var(--twenty-page)] text-[var(--twenty-ink)]">
      <GameSidebar className="border-[var(--twenty-border)] bg-[var(--twenty-panel)]">
        <GameHeader
          accentClassName="bg-[linear-gradient(90deg,var(--twenty-tile-8),var(--twenty-tile-128),var(--twenty-tile-2048))]"
          backButtonTestId="twenty-forty-eight-back-to-menu"
          onBackToMenu={onBackToMenu}
          status={statusLabels[game.status]}
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
              {game.bestScore}
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

        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
          <div className="grid w-full grid-cols-3 gap-2">
            <Button
              aria-label="Move up"
              className="col-start-2"
              onClick={() => moveTiles("up")}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <ArrowUpIcon />
            </Button>
            <Button
              aria-label="Move left"
              onClick={() => moveTiles("left")}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <ArrowLeftIcon />
            </Button>
            <Button
              aria-label="Move down"
              onClick={() => moveTiles("down")}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <ArrowDownIcon />
            </Button>
            <Button
              aria-label="Move right"
              onClick={() => moveTiles("right")}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <ArrowRightIcon />
            </Button>
          </div>
        </div>
      </GameSidebar>

      <GameBoardColumn className="max-w-[min(92vw,37.25rem)]">
        <GameBoardStage
          actions={
            <GameBoardActions
              helpDisabled={isHelpVisible}
              onHelp={openHelp}
              onRestart={restartGame}
              testIdPrefix="twenty-forty-eight"
            />
          }
        >
          <TwentyFortyEightBoard game={game} statusLabel={statusLabels[game.status]}>
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
                    {statusLabels[game.status]}
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
            </div>
          ) : showEndScreen ? (
            <div
              className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[color-mix(in_oklch,var(--twenty-board)_78%,transparent)] px-4 py-5 text-center text-[var(--twenty-board-text)] backdrop-blur-[2px]"
              data-testid="twenty-forty-eight-end-screen"
            >
              <div className="flex flex-col items-center gap-1">
                <p className="text-3xl font-semibold tracking-normal text-balance">
                  {game.status === "won" ? "2048 reached" : "No moves left"}
                </p>
                <p className="text-sm font-semibold text-[color-mix(in_oklch,var(--twenty-board-text)_76%,transparent)]">
                  Final score
                </p>
                <p className="font-mono text-5xl font-semibold leading-none">{game.score}</p>
              </div>
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
            </div>
          ) : null}
          {isHelpVisible ? (
            <GameHelpScreen
              className="border-[color-mix(in_oklch,var(--twenty-board-text)_24%,transparent)] bg-[color-mix(in_oklch,var(--twenty-board)_94%,black)] text-[var(--twenty-board-text)]"
              onClose={closeHelp}
              sections={TWENTY_FORTY_EIGHT_HELP_SECTIONS}
              testId="twenty-forty-eight-help-screen"
              title="Classic 2048"
            />
          ) : null}
          </TwentyFortyEightBoard>
        </GameBoardStage>

        <div className="flex items-center justify-between rounded-md border border-[var(--twenty-border)] bg-[var(--twenty-panel)] px-3 py-2 text-xs font-medium text-[var(--twenty-muted)]">
          <span>Board {twentyFortyEightBoardSizeLabel}</span>
          <span
            className={cn(
              "rounded-[0.2rem] px-2 py-1 font-semibold",
              game.status === "won"
                ? "bg-[color-mix(in_oklch,var(--twenty-tile-2048)_18%,white)] text-[var(--twenty-tile-2048)]"
                : "bg-[color-mix(in_oklch,var(--twenty-tile-8)_16%,white)] text-[var(--twenty-tile-8)]",
            )}
            data-testid="twenty-forty-eight-board-state"
          >
            {statusLabels[game.status]}
          </span>
        </div>
      </GameBoardColumn>
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
