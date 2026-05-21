"use client";

import { ArrowDownIcon, ArrowUpIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
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
import { PongBoard, pongBoardSizeLabel } from "@/components/pong-board";
import { Button } from "@/components/ui/button";
import {
  advancePongGame,
  createInitialPongGame,
  getPongTickDelay,
  movePongPlayerDown,
  movePongPlayerUp,
  pausePongGame,
  PONG_TARGET_SCORE,
  restartPongGame,
  startPongGame,
  type PongGameState,
  type PongStatus,
} from "@/lib/pong-game-engine";

type PongGameProps = {
  onBackToMenu?: () => void;
};

const statusLabels: Record<PongStatus, string> = {
  lost: "CPU wins",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
  won: "You won",
};

const PONG_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [{ text: "Enter", label: "Enter key" }],
        label: "Start game",
      },
      {
        buttons: [{ icon: ArrowUpIcon, label: "Up" }, { text: "W", label: "W key" }],
        label: "Move paddle up",
      },
      {
        buttons: [{ icon: ArrowDownIcon, label: "Down" }, { text: "S", label: "S key" }],
        label: "Move paddle down",
      },
      {
        buttons: [
          { text: "Space", label: "Space key" },
          { text: "P", label: "P key" },
        ],
        label: "Pause or resume",
      },
    ],
  },
  {
    title: "Rules",
    items: [
      "Keep the ball past the CPU paddle to score.",
      "Block the ball before it passes your paddle.",
      `First side to ${PONG_TARGET_SCORE} points wins the match.`,
    ],
  },
];

export function PongGame({ onBackToMenu }: PongGameProps = {}) {
  const [game, setGame] = useState<PongGameState>(() => createInitialPongGame());
  const tickDelay = game.status === "running" ? getPongTickDelay() : null;
  const canPauseGame = game.status === "running" || game.status === "paused";
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const showStartScreen = game.status === "ready";
  const showEndScreen = game.status === "lost" || game.status === "won";
  const showPauseScreen = game.status === "paused";

  const startGame = useCallback(() => {
    setGame((current) => startPongGame(current));
  }, []);

  const toggleRunState = useCallback(() => {
    setGame((current) => {
      if (current.status === "running") {
        return pausePongGame(current);
      }

      return startPongGame(current);
    });
  }, []);

  const restartGame = useCallback(() => {
    setGame(restartPongGame());
  }, []);

  const moveUp = useCallback(() => {
    setGame((current) => movePongPlayerUp(current));
  }, []);

  const moveDown = useCallback(() => {
    setGame((current) => movePongPlayerDown(current));
  }, []);

  const advancePong = useCallback(() => {
    setGame((current) => advancePongGame(current));
  }, []);

  const pauseGameForHelp = useCallback(() => {
    setGame((current) => pausePongGame(current));
  }, []);

  const resumeGameAfterHelp = useCallback(() => {
    setGame((current) => startPongGame(current));
  }, []);

  const { closeHelp, isHelpVisible, openHelp } = useGameHelpScreen({
    isGameActive: game.status === "running",
    onPauseGame: pauseGameForHelp,
    onResumeGame: resumeGameAfterHelp,
  });

  useEffect(() => {
    if (tickDelay === null) {
      return;
    }

    const tick = window.setInterval(advancePong, tickDelay);

    return () => window.clearInterval(tick);
  }, [advancePong, tickDelay]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isHelpVisible || isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
        event.preventDefault();
        moveUp();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
        event.preventDefault();
        moveDown();
        return;
      }

      if (event.key === "Enter" && game.status !== "running" && game.status !== "paused") {
        event.preventDefault();
        startGame();
        return;
      }

      if (event.key === " " || event.key === "p" || event.key === "P") {
        event.preventDefault();
        toggleRunState();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game.status, isHelpVisible, moveDown, moveUp, startGame, toggleRunState]);

  return (
    <GameShell className="bg-[var(--pong-page)] text-[var(--pong-ink)]">
      <GameSidebar className="border-[var(--pong-border)] bg-[var(--pong-panel)]">
        <GameHeader
          accentClassName="bg-[linear-gradient(90deg,var(--pong-blue),var(--pong-ball),var(--pong-pink))]"
          backButtonTestId="pong-back-to-menu"
          onBackToMenu={onBackToMenu}
          status={statusLabels[game.status]}
          statusClassName="text-[var(--pong-muted)]"
          statusTestId="pong-status"
          title="Classic Pong"
        />

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[var(--pong-border)] p-3">
            <dt className="text-xs font-medium text-[var(--pong-muted)]">Player</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="pong-player-score"
            >
              {game.score.player}
            </dd>
          </div>
          <div className="rounded-md border border-[var(--pong-border)] p-3">
            <dt className="text-xs font-medium text-[var(--pong-muted)]">CPU</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="pong-cpu-score"
            >
              {game.score.cpu}
            </dd>
          </div>
        </dl>

        <div className="rounded-md border border-[var(--pong-border)] p-3">
          <p className="text-xs font-medium text-[var(--pong-muted)]">Target</p>
          <p className="font-mono text-3xl font-semibold leading-none">{PONG_TARGET_SCORE}</p>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
          <div className="grid w-full grid-cols-2 gap-2">
            <Button
              aria-label="Move paddle up"
              onClick={moveUp}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <ArrowUpIcon />
            </Button>
            <Button
              aria-label="Move paddle down"
              onClick={moveDown}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <ArrowDownIcon />
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
              pauseAction={{
                disabled: isHelpVisible || !canPauseGame,
                isResume: game.status === "paused",
                label: pauseActionLabel,
                onClick: toggleRunState,
              }}
              restartDisabled={game.status === "ready"}
              testIdPrefix="pong"
            />
          }
        >
          <PongBoard game={game} statusLabel={statusLabels[game.status]}>
          {showStartScreen ? (
            <div
              className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[#081525] px-4 py-5 text-center text-[#e5f2ff]"
              data-testid="pong-start-screen"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="relative h-24 w-36 rounded-md border border-[#23415e] bg-[#06101f]" aria-hidden="true">
                  <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 border-l border-dashed border-[#e5f2ff]/60" />
                  <span className="absolute left-4 top-7 h-10 w-1.5 rounded-full bg-[#38bdf8]" />
                  <span className="absolute right-4 top-7 h-10 w-1.5 rounded-full bg-[#f472b6]" />
                  <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f8fafc]" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-3xl font-semibold tracking-normal text-balance">Classic Pong</p>
                  <p className="text-sm font-medium text-[#9fb6c9]">First to {PONG_TARGET_SCORE}</p>
                </div>
              </div>
              <Button
                className="min-w-32"
                data-testid="pong-start-button"
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
              className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[rgba(8,21,37,0.82)] px-4 py-5 text-center text-[#e5f2ff] backdrop-blur-[2px]"
              data-testid="pong-end-screen"
            >
              <div className="flex flex-col items-center gap-1">
                <p className="text-3xl font-semibold tracking-normal text-balance">
                  {game.status === "won" ? "Match won" : "Match lost"}
                </p>
                <p className="text-sm font-semibold text-[#9fb6c9]">Final score</p>
                <p className="font-mono text-5xl font-semibold leading-none">
                  {game.score.player}-{game.score.cpu}
                </p>
              </div>
              <Button
                className="min-w-36"
                data-testid="pong-new-game-button"
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
              className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[rgba(8,21,37,0.76)] text-center text-[#e5f2ff] backdrop-blur-[2px]"
              data-testid="pong-board-state"
            >
              <div className="flex flex-col items-center gap-3">
                <p className="text-2xl font-semibold tracking-normal">Paused</p>
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
              className="border-[#e5f2ff]/25 bg-[#081525] text-[#e5f2ff]"
              onClose={closeHelp}
              sections={PONG_HELP_SECTIONS}
              testId="pong-help-screen"
              title="Classic Pong"
            />
          ) : null}
          </PongBoard>
        </GameBoardStage>

        <div className="flex items-center justify-between rounded-md border border-[var(--pong-border)] bg-[var(--pong-panel)] px-3 py-2 text-xs font-medium text-[var(--pong-muted)]">
          <span>Board {pongBoardSizeLabel}</span>
          <span>Speed {tickDelay === null ? "0" : Math.round(1000 / tickDelay)}</span>
        </div>
      </GameBoardColumn>
    </GameShell>
  );
}
