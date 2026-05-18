"use client";

import { PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { isTypingTarget } from "@/components/game-input";
import { GameBoardColumn, GameHeader, GameShell, GameSidebar } from "@/components/game-layout";
import { SimonBoard } from "@/components/simon-board";
import { Button } from "@/components/ui/button";
import {
  advanceSimonPlayback,
  clearSimonActivePad,
  createInitialSimonGame,
  getSimonInputFlashDelay,
  getSimonPlaybackDelay,
  pauseSimonGame,
  playSimonPad,
  restartSimonGame,
  startSimonGame,
  type SimonGameState,
  type SimonPadId,
  type SimonStatus,
} from "@/lib/simon-game-engine";

type SimonGameProps = {
  onBackToMenu?: () => void;
};

const statusLabels: Record<SimonStatus, string> = {
  input: "Repeat",
  lost: "Game over",
  paused: "Paused",
  ready: "Ready",
  showing: "Watch",
  won: "Sequence cleared",
};

const keyToSimonPad: Record<string, SimonPadId> = {
  "1": "green",
  "2": "red",
  "3": "yellow",
  "4": "blue",
  e: "yellow",
  E: "yellow",
  q: "green",
  Q: "green",
  r: "blue",
  R: "blue",
  w: "red",
  W: "red",
};

function createReadySimonGame() {
  return createInitialSimonGame();
}

export function SimonGame({ onBackToMenu }: SimonGameProps = {}) {
  const [game, setGame] = useState<SimonGameState>(() => createReadySimonGame());
  const playbackDelay = game.status === "showing" ? getSimonPlaybackDelay() : null;
  const primaryAction =
    game.status === "showing" || game.status === "input"
      ? "Pause"
      : game.status === "paused"
        ? "Resume"
        : "Start";
  const PrimaryIcon =
    game.status === "showing" || game.status === "input" ? PauseIcon : PlayIcon;
  const progressLabel = useMemo(() => {
    if (game.status === "input") {
      return `${game.inputIndex}/${game.sequence.length}`;
    }

    if (game.status === "showing") {
      return `${Math.min(game.playbackIndex + 1, game.sequence.length)}/${game.sequence.length}`;
    }

    return `${game.score}/${game.winTarget}`;
  }, [game.inputIndex, game.playbackIndex, game.score, game.sequence.length, game.status, game.winTarget]);
  const showStartScreen = game.status === "ready";
  const showPauseScreen = game.status === "paused";
  const showEndScreen = game.status === "lost" || game.status === "won";
  const showSideActions =
    game.status === "showing" || game.status === "input" || game.status === "paused";

  const startGame = useCallback(() => {
    setGame((current) => startSimonGame(current, { random: Math.random }));
  }, []);

  const toggleRunState = useCallback(() => {
    setGame((current) => {
      if (current.status === "showing" || current.status === "input") {
        return pauseSimonGame(current);
      }

      return startSimonGame(current, { random: Math.random });
    });
  }, []);

  const restartGame = useCallback(() => {
    setGame((current) => restartSimonGame(current, { random: Math.random }));
  }, []);

  const pressPad = useCallback((pad: SimonPadId) => {
    setGame((current) => playSimonPad(current, pad, { random: Math.random }));
  }, []);

  useEffect(() => {
    if (playbackDelay === null) {
      return;
    }

    const playbackTimer = window.setTimeout(() => {
      setGame((current) => advanceSimonPlayback(current));
    }, playbackDelay);

    return () => window.clearTimeout(playbackTimer);
  }, [game.activePad, game.playbackIndex, playbackDelay]);

  useEffect(() => {
    if (game.status !== "input" || game.activePad === null) {
      return;
    }

    const flashTimer = window.setTimeout(() => {
      setGame((current) => clearSimonActivePad(current));
    }, getSimonInputFlashDelay());

    return () => window.clearTimeout(flashTimer);
  }, [game.activePad, game.status]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "Enter" && game.status !== "showing" && game.status !== "input") {
        event.preventDefault();
        startGame();
        return;
      }

      if (event.key === " " || event.key === "p" || event.key === "P") {
        event.preventDefault();
        toggleRunState();
        return;
      }

      const pad = keyToSimonPad[event.key];

      if (pad) {
        event.preventDefault();
        pressPad(pad);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game.status, pressPad, startGame, toggleRunState]);

  return (
    <GameShell className="bg-[#f6f9fc] text-[#172033]">
      <GameSidebar className="border-[#d6dfeb] bg-white">
        <GameHeader
          accentClassName="bg-[linear-gradient(90deg,#25a75a,#d73548,#f0bd38,#1d7ed0)]"
          backButtonTestId="simon-back-to-menu"
          onBackToMenu={onBackToMenu}
          status={statusLabels[game.status]}
          statusClassName="text-[#59687d]"
          statusTestId="simon-status"
          title="Classic Simon"
        />

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[#d6dfeb] p-3">
            <dt className="text-xs font-medium text-[#59687d]">Score</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="simon-score"
            >
              {game.score}
            </dd>
          </div>
          <div className="rounded-md border border-[#d6dfeb] p-3">
            <dt className="text-xs font-medium text-[#59687d]">Round</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="simon-round"
            >
              {game.round}
            </dd>
          </div>
        </dl>

        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
          <div className="rounded-md border border-[#d6dfeb] p-3">
            <p className="text-xs font-medium text-[#59687d]">Progress</p>
            <p
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="simon-progress"
            >
              {progressLabel}
            </p>
          </div>
          <div className="rounded-md border border-[#d6dfeb] p-3">
            <p className="text-xs font-medium text-[#59687d]">Target</p>
            <p
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="simon-target"
            >
              {game.winTarget}
            </p>
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
              aria-label="Press green pad"
              disabled={game.status !== "input"}
              onClick={() => pressPad("green")}
              type="button"
              variant="outline"
            >
              1
            </Button>
            <Button
              aria-label="Press red pad"
              disabled={game.status !== "input"}
              onClick={() => pressPad("red")}
              type="button"
              variant="outline"
            >
              2
            </Button>
            <Button
              aria-label="Press yellow pad"
              disabled={game.status !== "input"}
              onClick={() => pressPad("yellow")}
              type="button"
              variant="outline"
            >
              3
            </Button>
            <Button
              aria-label="Press blue pad"
              disabled={game.status !== "input"}
              onClick={() => pressPad("blue")}
              type="button"
              variant="outline"
            >
              4
            </Button>
          </div>
        </div>
      </GameSidebar>

      <GameBoardColumn className="max-w-[min(92vw,34rem)]">
        <SimonBoard game={game} onPadPress={pressPad} statusLabel={statusLabels[game.status]}>
          {showStartScreen ? (
            <div
              className="absolute inset-3 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[#f8fbff]/92 px-4 py-5 text-center text-[#172033] backdrop-blur-[2px]"
              data-testid="simon-start-screen"
            >
              <div className="flex flex-col items-center gap-2">
                <div
                  className="grid size-20 grid-cols-2 gap-1 rounded-full border-8 border-[#141923] bg-[#141923] p-1"
                  aria-hidden="true"
                >
                  <span className="rounded-tl-full bg-[#25a75a]" />
                  <span className="rounded-tr-full bg-[#d73548]" />
                  <span className="rounded-bl-full bg-[#f0bd38]" />
                  <span className="rounded-br-full bg-[#1d7ed0]" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-3xl font-semibold tracking-normal text-balance">
                    Classic Simon
                  </p>
                  <p className="text-sm font-medium text-[#59687d]">
                    {statusLabels[game.status]}
                  </p>
                </div>
              </div>
              <Button
                className="min-w-32"
                data-testid="simon-start-button"
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
              className="absolute inset-3 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[#f8fbff]/86 px-4 py-5 text-center text-[#172033] backdrop-blur-[2px]"
              data-testid="simon-end-screen"
            >
              <div className="flex flex-col items-center gap-1">
                <p className="text-3xl font-semibold tracking-normal text-balance">
                  {game.status === "won" ? "Sequence cleared" : "Game over"}
                </p>
                <p className="text-sm font-semibold text-[#59687d]">Final score</p>
                <p className="font-mono text-5xl font-semibold leading-none">{game.score}</p>
              </div>
              <Button
                className="min-w-36"
                data-testid="simon-new-game-button"
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
              className="absolute inset-3 flex items-center justify-center rounded-[0.375rem] bg-[#f8fbff]/78 text-center text-[#172033] backdrop-blur-[2px]"
              data-testid="simon-board-state"
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
        </SimonBoard>

        <div className="flex items-center justify-between rounded-md border border-[#d6dfeb] bg-white px-3 py-2 text-xs font-medium text-[#59687d]">
          <span>Keys 1-4 or QWER</span>
          <span>Speed {playbackDelay === null ? "0" : Math.round(1000 / playbackDelay)}</span>
        </div>
      </GameBoardColumn>
    </GameShell>
  );
}
