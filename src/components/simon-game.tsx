"use client";

import { PlayIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  isGamePauseKey,
  registerGameKeyDown,
  shouldIgnoreGameKeyDown,
} from "@/components/game-input";
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
import { SimonBoard } from "@/components/simon-board";
import { Button } from "@/components/ui/button";
import {
  advanceSimonMiss,
  advanceSimonRound,
  advanceSimonPlayback,
  clearSimonActivePad,
  createInitialSimonGame,
  getSimonInputFlashDelay,
  getSimonMissFeedbackDelay,
  getSimonPlaybackDelay,
  getSimonRoundCompleteDelay,
  pauseSimonGame,
  playSimonPad,
  restartSimonGame,
  startSimonGame,
  type SimonGameState,
  type SimonPadId,
  type SimonStatus,
} from "@/lib/simon-game-engine";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import { useGameLeaderboard } from "@/hooks/use-game-leaderboard";
import { useGameSession } from "@/hooks/use-game-session";

type SimonGameProps = {
  initialWinTarget?: number;
  onBackToMenu?: () => void;
};

const statusLabels: Record<SimonStatus, string> = {
  correct: "Correct",
  input: "Repeat",
  lost: "Game over",
  missed: "Miss",
  paused: "Paused",
  ready: "Ready",
  showing: "Watch",
  won: "Sequence cleared",
};

const SIMON_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [{ text: "Enter", label: "Enter key" }],
        label: "Start game",
      },
      {
        buttons: [{ text: "1", label: "1 key" }, { text: "Q", label: "Q key" }],
        label: "Green pad",
      },
      {
        buttons: [{ text: "2", label: "2 key" }, { text: "W", label: "W key" }],
        label: "Red pad",
      },
      {
        buttons: [{ text: "3", label: "3 key" }, { text: "E", label: "E key" }],
        label: "Yellow pad",
      },
      {
        buttons: [{ text: "4", label: "4 key" }, { text: "R", label: "R key" }],
        label: "Blue pad",
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
      "Watch the highlighted sequence, then repeat it in order.",
      "Each cleared round adds one more pad to the pattern.",
      "One wrong pad ends the game; clear the target sequence to win.",
    ],
  },
];

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

function createReadySimonGame(winTarget?: number) {
  return createInitialSimonGame({ winTarget });
}

export function SimonGame({ initialWinTarget, onBackToMenu }: SimonGameProps = {}) {
  const [game, setGame] = useState<SimonGameState>(() =>
    createReadySimonGame(initialWinTarget),
  );
  const playbackDelay = game.status === "showing" ? getSimonPlaybackDelay() : null;
  const roundCompleteDelay =
    game.status === "correct" && game.activePad === null
      ? getSimonRoundCompleteDelay()
      : null;
  const missFeedbackDelay =
    game.status === "missed" && game.activePad === null
      ? getSimonMissFeedbackDelay()
      : null;
  const canPauseGame =
    game.status === "showing" ||
    game.status === "input" ||
    game.status === "correct" ||
    game.status === "missed" ||
    game.status === "paused";
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const progressLabel = useMemo(() => {
    if (game.status === "input") {
      return `${game.inputIndex}/${game.sequence.length}`;
    }

    if (game.status === "showing") {
      return `${Math.min(game.playbackIndex + 1, game.sequence.length)}/${game.sequence.length}`;
    }

    return `${game.score}/${game.winTarget}`;
  }, [game.inputIndex, game.playbackIndex, game.score, game.sequence.length, game.status, game.winTarget]);
  const isTurnFeedbackWaitingForFlash =
    (game.status === "correct" || game.status === "missed") && game.activePad !== null;
  const statusLabel = isTurnFeedbackWaitingForFlash ? statusLabels.input : statusLabels[game.status];
  const showStartScreen = game.status === "ready";
  const showCorrectFeedback = game.status === "correct" && game.activePad === null;
  const showMissFeedback = game.status === "missed" && game.activePad === null;
  const showPauseScreen = game.status === "paused";
  const showEndScreen = game.status === "lost" || game.status === "won";
  const leaderboardKey = createGameLeaderboardKey("simon", [
    { name: "target", value: game.winTarget },
  ]);
  const isSimonActive =
    game.status === "showing" ||
    game.status === "input" ||
    game.status === "correct" ||
    game.status === "missed";
  const { completedSessionId } = useGameSession({
    active: isSimonActive,
    finalResult:
      game.status === "lost" || game.status === "won" ? game.status : null,
    finalScore: game.score,
    gameId: "simon",
    leaderboardKey,
    started: canPauseGame || showEndScreen,
  });
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
    gameSessionId: completedSessionId,
    leaderboardKey,
    pendingScore: showEndScreen ? game.score : null,
  });

  const startGame = useCallback(() => {
    resetLeaderboardForm();
    setGame((current) => startSimonGame(current, { random: Math.random }));
  }, [resetLeaderboardForm]);

  const toggleRunState = useCallback(() => {
    resetLeaderboardForm();
    setGame((current) => {
      if (
        current.status === "showing" ||
        current.status === "input" ||
        current.status === "correct" ||
        current.status === "missed"
      ) {
        return pauseSimonGame(current);
      }

      return startSimonGame(current, { random: Math.random });
    });
  }, [resetLeaderboardForm]);

  const restartGame = useCallback(() => {
    resetLeaderboardForm();
    setGame((current) => restartSimonGame(current, { random: Math.random }));
  }, [resetLeaderboardForm]);

  const pressPad = useCallback((pad: SimonPadId) => {
    setGame((current) => playSimonPad(current, pad));
  }, []);

  const saveLeaderboardScore = useCallback(() => {
    void savePendingLeaderboardScore();
  }, [savePendingLeaderboardScore]);

  const pauseGameForHelp = useCallback(() => {
    setGame((current) => pauseSimonGame(current));
  }, []);

  const resumeGameAfterHelp = useCallback(() => {
    setGame((current) => startSimonGame(current, { random: Math.random }));
  }, []);

  const { closeHelp, isHelpVisible, openHelp } = useGameHelpScreen({
    isGameActive: isSimonActive,
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
    if (playbackDelay === null) {
      return;
    }

    const playbackTimer = window.setTimeout(() => {
      setGame((current) => advanceSimonPlayback(current));
    }, playbackDelay);

    return () => window.clearTimeout(playbackTimer);
  }, [game.activePad, game.playbackIndex, playbackDelay]);

  useEffect(() => {
    if (
      (game.status !== "input" &&
        game.status !== "correct" &&
        game.status !== "missed") ||
      game.activePad === null
    ) {
      return;
    }

    const flashTimer = window.setTimeout(() => {
      setGame((current) => clearSimonActivePad(current));
    }, getSimonInputFlashDelay());

    return () => window.clearTimeout(flashTimer);
  }, [game.activePad, game.status]);

  useEffect(() => {
    if (roundCompleteDelay === null) {
      return;
    }

    const roundCompleteTimer = window.setTimeout(() => {
      setGame((current) => advanceSimonRound(current, { random: Math.random }));
    }, roundCompleteDelay);

    return () => window.clearTimeout(roundCompleteTimer);
  }, [roundCompleteDelay]);

  useEffect(() => {
    if (missFeedbackDelay === null) {
      return;
    }

    const missFeedbackTimer = window.setTimeout(() => {
      setGame((current) => advanceSimonMiss(current));
    }, missFeedbackDelay);

    return () => window.clearTimeout(missFeedbackTimer);
  }, [missFeedbackDelay]);

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

      if (
        event.key === "Enter" &&
        game.status !== "showing" &&
        game.status !== "input" &&
        game.status !== "correct" &&
        game.status !== "missed"
      ) {
        event.preventDefault();
        startGame();
        return;
      }

      if (isGamePauseKey(event.key)) {
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

    return registerGameKeyDown(handleKeyDown);
  }, [game.status, isHelpVisible, pendingLeaderboardEntry, pressPad, startGame, toggleRunState]);

  return (
    <GameShell className="bg-[#f6f9fc] text-[#172033]">
      <GameSidebar className="border-[#d6dfeb] bg-white">
        <GameHeader
          status={statusLabel}
          statusTestId="simon-status"
          title="Classic Simon"
        />

        <dl className="grid grid-cols-2 gap-3">
          <GameStatCard
            className="border-[#d6dfeb]"
            label="Score"
            labelClassName="text-[#59687d]"
            value={game.score}
            valueTestId="simon-score"
          />
          <GameStatCard
            className="border-[#d6dfeb]"
            label="Round"
            labelClassName="text-[#59687d]"
            value={game.round}
            valueTestId="simon-round"
          />
        </dl>

        <dl className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
          <GameStatCard
            className="border-[#d6dfeb]"
            label="Progress"
            labelClassName="text-[#59687d]"
            value={progressLabel}
            valueTestId="simon-progress"
          />
          <GameStatCard
            className="border-[#d6dfeb]"
            label="Target"
            labelClassName="text-[#59687d]"
            value={game.winTarget}
            valueTestId="simon-target"
          />
        </dl>

        <dl>
          <GameStatCard
            className="border-[#d6dfeb]"
            label="Speed"
            labelClassName="text-[#59687d]"
            value={playbackDelay === null ? "0" : Math.round(1000 / playbackDelay)}
            valueTestId="simon-speed"
          />
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
              onRestart={restartGame}
              pauseAction={{
                disabled: isHelpVisible || !canPauseGame,
                isResume: game.status === "paused",
                label: pauseActionLabel,
                onClick: toggleRunState,
              }}
              restartDisabled={game.status === "ready" || pendingLeaderboardEntry !== null}
              testIdPrefix="simon"
            />
          }
        >
          <SimonBoard game={game} onPadPress={pressPad} statusLabel={statusLabel}>
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
              <GameLeaderboardPanel
                slotTestIdPrefix="simon-leaderboard-slot"
                slots={leaderboardSlots}
                statusMessage={leaderboardStatusMessage}
                testId="simon-start-leaderboard"
              />
            </div>
          ) : showCorrectFeedback ? (
            <div
              className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-[0.375rem] text-center text-[#172033]"
              data-testid="simon-correct-feedback"
              role="status"
            >
              <p className="simon-turn-feedback rounded-md border border-[#172033]/10 bg-[#f8fbff]/88 px-5 py-3 text-3xl font-black tracking-normal shadow-[0_18px_46px_rgba(15,23,42,0.22)] backdrop-blur-[2px] sm:text-4xl">
                CORRECT!
              </p>
            </div>
          ) : showMissFeedback ? (
            <div
              className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-[0.375rem] text-center text-[#172033]"
              data-testid="simon-miss-feedback"
              role="status"
            >
              <p className="simon-turn-feedback rounded-md border border-[#8a2431]/20 bg-[#fff5f6]/90 px-5 py-3 text-3xl font-black tracking-normal text-[#8a2431] shadow-[0_18px_46px_rgba(138,36,49,0.24)] backdrop-blur-[2px] sm:text-4xl">
                MISS!
              </p>
            </div>
          ) : showEndScreen ? (
            <GameEndScreen testId="simon-end-screen">
              <GameEndLeaderboardContent
                action={
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
                }
                leaderboard={{
                  slotTestIdPrefix: "simon-final-leaderboard-slot",
                  slots: leaderboardSlots,
                  statusMessage: leaderboardStatusMessage,
                  testId: "simon-final-leaderboard",
                }}
                pendingLeaderboardEntry={pendingLeaderboardEntry}
                scoreForm={{
                  isSaving: isSavingLeaderboardScore,
                  onPlayerNameChange: setPlayerName,
                  onSaveScore: saveLeaderboardScore,
                  playerName,
                  saveFailed: scoreSaveFailed,
                  testIdPrefix: "simon",
                }}
                summary={{
                  metricLabel: "Final score",
                  metricValue: game.score,
                  metricValueTestId: "simon-final-score",
                  title: game.status === "won" ? "Sequence cleared" : "Game over",
                }}
              />
            </GameEndScreen>
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
          {isHelpVisible ? (
            <GameHelpScreen
              className="border-[#172033]/20 bg-[#f8fbff] text-[#172033]"
              onClose={closeHelp}
              sections={SIMON_HELP_SECTIONS}
              testId="simon-help-screen"
              title="Classic Simon"
            />
          ) : null}
          </SimonBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}
