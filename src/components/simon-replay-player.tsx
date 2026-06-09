"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { GameLeaderboardPanel } from "@/components/game-leaderboard";
import {
  GameBoardActions,
  GameBoardColumn,
  GameBoardStage,
  GameEndScreen,
  GameHeader,
  GameShell,
  GameSidebar,
  GameStatsBar,
  GameStatCard,
  useGameEscapeToMenu,
} from "@/components/game-layout";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { SimonBoard } from "@/components/simon-board";
import { Button } from "@/components/ui/button";
import {
  getSimonInputFlashDelay,
  getSimonMissFeedbackDelay,
  getSimonPlaybackDelay,
  getSimonRoundCompleteDelay,
  type SimonGameState,
  type SimonStatus,
} from "@/lib/simon-game-engine";
import {
  applySimonReplayEvent,
  createDefaultSimonReplayLeaderboardKey,
  createInitialSimonReplayGame,
  fetchSimonReplay,
  type SimonReplayEvent,
  type SimonReplayPayload,
} from "@/lib/simon-replay";

type SimonReplayPlayerProps = {
  onBackToProfile: () => void;
};

type PlaybackState = {
  eventIndex: number;
  events: SimonReplayEvent[];
  random: () => number;
};

const SIMON_REPLAY_START_DELAY_MS = 180;
const SIMON_REPLAY_INPUT_STEP_MS = 420;

const replayStatusLabels = {
  failed: "Replay unavailable",
  loading: "Loading replay",
  playing: "Replay playing",
  ready: "Replay ready",
} as const;

const simonStatusLabels: Record<SimonStatus, string> = {
  correct: "Correct",
  input: "Repeat",
  lost: "Game over",
  missed: "Miss",
  paused: "Paused",
  ready: "Ready",
  showing: "Watch",
  won: "Sequence cleared",
};

function getSimonReplayProgressLabel(game: SimonGameState) {
  if (game.status === "input") {
    return `${game.inputIndex}/${game.sequence.length}`;
  }

  if (game.status === "showing") {
    return `${Math.min(game.playbackIndex + 1, game.sequence.length)}/${game.sequence.length}`;
  }

  return `${game.score}/${game.winTarget}`;
}

function getSimonReplayStatusLabel(game: SimonGameState, isFinished: boolean) {
  if (isFinished) {
    return "Replay finished";
  }

  if ((game.status === "correct" || game.status === "missed") && game.activePad !== null) {
    return simonStatusLabels.input;
  }

  return simonStatusLabels[game.status];
}

function getSimonReplayEventDelay(event: SimonReplayEvent | undefined) {
  if (event === undefined) {
    return SIMON_REPLAY_START_DELAY_MS;
  }

  switch (event.type) {
    case "advanceMiss":
      return getSimonMissFeedbackDelay();
    case "advanceRound":
      return getSimonRoundCompleteDelay();
    case "clear":
      return getSimonInputFlashDelay();
    case "pad":
      return SIMON_REPLAY_INPUT_STEP_MS;
    case "playback":
      return getSimonPlaybackDelay();
    case "start":
      return SIMON_REPLAY_START_DELAY_MS;
  }
}

export function SimonReplayTurnFeedback({
  game,
}: {
  game: Pick<SimonGameState, "activePad" | "status">;
}) {
  if (game.status === "correct" && game.activePad === null) {
    return (
      <div
        className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-[0.375rem] text-center text-[#172033]"
        data-testid="simon-replay-correct-feedback"
        role="status"
      >
        <p className="simon-turn-feedback rounded-md border border-[#172033]/10 bg-[#f8fbff]/88 px-5 py-3 text-3xl font-black tracking-normal shadow-[0_18px_46px_rgba(15,23,42,0.22)] backdrop-blur-[2px] sm:text-4xl">
          CORRECT!
        </p>
      </div>
    );
  }

  if (game.status === "missed" && game.activePad === null) {
    return (
      <div
        className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-[0.375rem] text-center text-[#172033]"
        data-testid="simon-replay-miss-feedback"
        role="status"
      >
        <p className="simon-turn-feedback rounded-md border border-[#8a2431]/20 bg-[#fff5f6]/90 px-5 py-3 text-3xl font-black tracking-normal text-[#8a2431] shadow-[0_18px_46px_rgba(138,36,49,0.24)] backdrop-blur-[2px] sm:text-4xl">
          MISS!
        </p>
      </div>
    );
  }

  return null;
}

function SimonReplayMessage({
  message,
  onBackToProfile,
  status,
}: {
  message: string;
  onBackToProfile: () => void;
  status: string;
}) {
  return (
    <GameShell className="bg-[#f6f9fc] text-[#172033]">
      <div className="mx-auto flex min-h-[60svh] w-full max-w-md flex-col items-center justify-center gap-4 rounded-md border border-[#d6dfeb] bg-white p-6 text-center shadow-sm">
        <GameHeader status={status} statusTestId="simon-replay-status" title="Simon replay" />
        <p className="text-lg font-semibold tracking-normal text-black">{message}</p>
        <Button onClick={onBackToProfile} type="button" variant="secondary">
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
      </div>
    </GameShell>
  );
}

export function SimonReplayPlayer({ onBackToProfile }: SimonReplayPlayerProps) {
  const [game, setGame] = useState<SimonGameState | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"failed" | "loading" | "ready">("loading");
  const [replay, setReplay] = useState<SimonReplayPayload | null>(null);
  const gameRef = useRef<SimonGameState | null>(null);
  const playbackRef = useRef<PlaybackState | null>(null);
  const leaderboardKey = replay?.leaderboardKey ?? createDefaultSimonReplayLeaderboardKey();
  const { finalLeaderboardProps } = useGameLeaderboardPresenter({
    leaderboardKey,
    pendingScore: null,
    testIdPrefix: "simon-replay",
  });
  const { requestBackToMenu } = useGameEscapeToMenu({
    isGameStarted: false,
    onBackToMenu: onBackToProfile,
  });

  useEffect(() => {
    let isCurrent = true;

    fetchSimonReplay()
      .then((latestReplay) => {
        if (!isCurrent) {
          return;
        }

        const initialReplay = createInitialSimonReplayGame(latestReplay);

        gameRef.current = initialReplay.game;
        playbackRef.current = {
          eventIndex: 0,
          events: latestReplay.events,
          random: initialReplay.random,
        };
        setGame(initialReplay.game);
        setIsFinished(false);
        setLoadStatus("ready");
        setReplay(latestReplay);
      })
      .catch(() => {
        if (isCurrent) {
          setLoadStatus("failed");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const advanceReplayFrame = useCallback(() => {
    const playback = playbackRef.current;
    const currentGame = gameRef.current;

    if (playback === null || currentGame === null || isFinished) {
      return;
    }

    const event = playback.events[playback.eventIndex];

    if (event === undefined) {
      setIsFinished(true);
      return;
    }

    const nextGame = applySimonReplayEvent(currentGame, event, playback.random);

    playback.eventIndex += 1;
    gameRef.current = nextGame;
    setGame(nextGame);

    if (
      playback.eventIndex >= playback.events.length ||
      nextGame.status === "lost" ||
      nextGame.status === "won"
    ) {
      setIsFinished(true);
    }
  }, [isFinished]);

  useEffect(() => {
    if (loadStatus !== "ready" || isFinished) {
      return;
    }

    const nextEvent = playbackRef.current?.events[playbackRef.current.eventIndex];
    const timeout = window.setTimeout(
      advanceReplayFrame,
      getSimonReplayEventDelay(nextEvent),
    );

    return () => window.clearTimeout(timeout);
  }, [advanceReplayFrame, game, isFinished, loadStatus]);

  const ignorePadPress = useCallback(() => undefined, []);

  if (loadStatus === "loading") {
    return (
      <SimonReplayMessage
        message="Loading Simon replay"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.loading}
      />
    );
  }

  if (loadStatus === "failed" || game === null) {
    return (
      <SimonReplayMessage
        message="No Simon replay is available"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.failed}
      />
    );
  }

  const statusLabel = getSimonReplayStatusLabel(game, isFinished);
  const progressLabel = getSimonReplayProgressLabel(game);

  return (
    <GameShell className="bg-[#f6f9fc] text-[#172033]">
      <GameBoardColumn className="w-[min(92vw,37.25rem,calc(100svh_-_12rem))]">
        <GameSidebar className="border-[#d6dfeb] bg-white">
          <GameHeader
            status={statusLabel}
            statusTestId="simon-replay-status"
            title="Simon replay"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[#d6dfeb]"
              label="Score"
              labelClassName="text-[#59687d]"
              value={game.score}
              valueTestId="simon-replay-score"
            />
            <GameStatCard
              className="border-[#d6dfeb]"
              label="Round"
              labelClassName="text-[#59687d]"
              value={game.round}
              valueTestId="simon-replay-round"
            />
            <GameStatCard
              className="border-[#d6dfeb]"
              label="Progress"
              labelClassName="text-[#59687d]"
              value={progressLabel}
              valueTestId="simon-replay-progress"
            />
            <GameStatCard
              className="border-[#d6dfeb]"
              label="Target"
              labelClassName="text-[#59687d]"
              value={game.winTarget}
              valueTestId="simon-replay-target"
            />
          </GameStatsBar>
        </GameSidebar>

        <GameBoardStage
          actions={
            <GameBoardActions onBackToMenu={requestBackToMenu} testIdPrefix="simon-replay" />
          }
        >
          <SimonBoard
            game={game}
            isInteractive={false}
            onPadPress={ignorePadPress}
            statusLabel={statusLabel}
          >
            <SimonReplayTurnFeedback game={game} />
            {isFinished ? (
              <GameEndScreen
                className="gap-3 px-3 py-4"
                testId="simon-replay-finished-screen"
              >
                <div className="flex flex-col items-center gap-1">
                  <p className="text-2xl font-semibold tracking-normal text-balance sm:text-3xl">
                    {game.status === "won" ? "Sequence cleared" : "Game over"}
                  </p>
                  <p className="text-xs font-semibold text-[#59687d] sm:text-sm">
                    Final score:
                  </p>
                  <p
                    className="font-mono text-4xl font-semibold leading-none sm:text-5xl"
                    data-testid="simon-replay-final-score"
                  >
                    {game.score}
                  </p>
                </div>
                <GameLeaderboardPanel
                  {...finalLeaderboardProps}
                  className="max-w-[17rem] p-2 sm:max-w-xs sm:p-3"
                />
                <Button
                  className="min-w-28"
                  data-testid="simon-replay-back-button"
                  onClick={requestBackToMenu ?? onBackToProfile}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
              </GameEndScreen>
            ) : null}
          </SimonBoard>
        </GameBoardStage>
      </GameBoardColumn>
    </GameShell>
  );
}
