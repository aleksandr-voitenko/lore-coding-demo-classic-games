"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useCallback } from "react";

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
import {
  getReplayEventElapsedMs,
  isFutureReplayEventFrame,
  type GameReplayTimedPlayback,
  useGameReplayPlayback,
} from "@/components/game-replay-playback";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { PongBoard } from "@/components/pong-board";
import { Button } from "@/components/ui/button";
import { type PongGameState } from "@/lib/pong-game-engine";
import {
  applyPongReplayEvent,
  createDefaultPongReplayLeaderboardKey,
  createInitialPongReplayGame,
  fetchPongReplay,
  type PongReplayEvent,
  type PongReplayPayload,
} from "@/lib/pong-replay";

type PongReplayPlayerProps = {
  onBackToProfile: () => void;
};

type PlaybackState = GameReplayTimedPlayback & {
  eventIndex: number;
  events: PongReplayEvent[];
};

const replayStatusLabels = {
  failed: "Replay unavailable",
  loading: "Loading replay",
  playing: "Replay playing",
  ready: "Replay ready",
} as const;

function isReplayFrameBoundary(event: PongReplayEvent) {
  return event.type === "advance" || event.type === "scoreTick" || event.type === "start";
}

function PongReplayMessage({
  message,
  onBackToProfile,
  status,
}: {
  message: string;
  onBackToProfile: () => void;
  status: string;
}) {
  return (
    <GameShell className="bg-[var(--pong-page)] text-[var(--pong-ink)]">
      <div className="mx-auto flex min-h-[60svh] w-full max-w-md flex-col items-center justify-center gap-4 rounded-md border border-[var(--pong-border)] bg-[var(--pong-panel)] p-6 text-center shadow-sm">
        <GameHeader status={status} statusTestId="pong-replay-status" title="Pong replay" />
        <p className="text-lg font-semibold tracking-normal">{message}</p>
        <Button onClick={onBackToProfile} type="button" variant="secondary">
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
      </div>
    </GameShell>
  );
}

export function PongReplayPlayer({ onBackToProfile }: PongReplayPlayerProps) {
  const initializeReplay = useCallback(
    (latestReplay: PongReplayPayload) => {
      const initialReplay = createInitialPongReplayGame(latestReplay);

      return {
        game: initialReplay.game,
        playback: {
          eventIndex: 0,
          events: latestReplay.events,
          lastElapsedMs: 0,
        } satisfies PlaybackState,
      };
    },
    [],
  );

  const advanceReplayFrame = useCallback(
    ({
      game,
      playback,
    }: {
      game: PongGameState;
      playback: PlaybackState;
    }) => {
      let nextGame = game;
      let lastElapsedMs: number | null = null;
      let processedFrame = false;
      const frameElapsedMs = getReplayEventElapsedMs(
        playback.events[playback.eventIndex],
      );
      const isTimedFrame = frameElapsedMs !== null;

      while (
        playback.eventIndex < playback.events.length &&
        (isTimedFrame || !processedFrame)
      ) {
        const event = playback.events[playback.eventIndex]!;

        if (isFutureReplayEventFrame(frameElapsedMs, event)) {
          break;
        }

        playback.eventIndex += 1;
        nextGame = applyPongReplayEvent(nextGame, event);
        lastElapsedMs = getReplayEventElapsedMs(event) ?? lastElapsedMs;
        processedFrame = isTimedFrame ? false : isReplayFrameBoundary(event);
      }

      playback.lastElapsedMs = lastElapsedMs ?? playback.lastElapsedMs;

      return {
        game: nextGame,
        isFinished:
          playback.eventIndex >= playback.events.length ||
          nextGame.status === "lost" ||
          nextGame.status === "won",
      };
    },
    [],
  );

  const { game, isFinished, loadStatus, replay } = useGameReplayPlayback({
    advanceFrame: advanceReplayFrame,
    initializeReplay,
    loadReplay: fetchPongReplay,
  });
  const leaderboardKey = replay?.leaderboardKey ?? createDefaultPongReplayLeaderboardKey();
  const { finalLeaderboardProps } = useGameLeaderboardPresenter({
    leaderboardKey,
    pendingScore: null,
    testIdPrefix: "pong-replay",
  });
  const { requestBackToMenu } = useGameEscapeToMenu({
    isGameStarted: false,
    onBackToMenu: onBackToProfile,
  });

  if (loadStatus === "loading") {
    return (
      <PongReplayMessage
        message="Loading Pong replay"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.loading}
      />
    );
  }

  if (loadStatus === "failed" || game === null) {
    return (
      <PongReplayMessage
        message="No Pong replay is available"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.failed}
      />
    );
  }

  const statusLabel = isFinished ? "Replay finished" : replayStatusLabels.playing;

  return (
    <GameShell className="bg-[var(--pong-page)] text-[var(--pong-ink)]">
      <GameBoardColumn className="w-[min(92vw,37.25rem,calc(75svh_-_9rem))]">
        <GameSidebar className="border-[var(--pong-border)] bg-[var(--pong-panel)]">
          <GameHeader
            status={statusLabel}
            statusTestId="pong-replay-status"
            title="Pong replay"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--pong-border)]"
              label="Score"
              labelClassName="text-[var(--pong-muted)]"
              value={game.remainingScore}
              valueTestId="pong-replay-remaining-score"
            />
            <GameStatCard
              className="border-[var(--pong-border)]"
              label="Target"
              labelClassName="text-[var(--pong-muted)]"
              value={game.targetScore}
              valueTestId="pong-replay-target"
            />
            <GameStatCard
              className="border-[var(--pong-border)]"
              label="Player"
              labelClassName="text-[var(--pong-muted)]"
              value={game.score.player}
              valueTestId="pong-replay-player-score"
            />
            <GameStatCard
              className="border-[var(--pong-border)]"
              label="Computer"
              labelClassName="text-[var(--pong-muted)]"
              value={game.score.cpu}
              valueTestId="pong-replay-cpu-score"
            />
          </GameStatsBar>
        </GameSidebar>

        <GameBoardStage
          actions={
            <GameBoardActions onBackToMenu={requestBackToMenu} testIdPrefix="pong-replay" />
          }
        >
          <PongBoard game={game} statusLabel={statusLabel}>
            {isFinished ? (
              <GameEndScreen
                className="gap-3 px-3 py-4"
                testId="pong-replay-finished-screen"
              >
                <div className="flex flex-col items-center gap-1">
                  <p className="text-2xl font-semibold tracking-normal text-balance sm:text-3xl">
                    {game.status === "won" ? "Match won" : "Match lost"}
                  </p>
                  <p className="text-xs font-semibold text-[#cbd5e1] sm:text-sm">
                    Remaining score:
                  </p>
                  <p
                    className="font-mono text-4xl font-semibold leading-none sm:text-5xl"
                    data-testid="pong-replay-final-score"
                  >
                    {game.remainingScore}
                  </p>
                </div>
                <GameLeaderboardPanel
                  {...finalLeaderboardProps}
                  className="max-w-[17rem] p-2 sm:max-w-xs sm:p-3"
                />
                <Button
                  className="min-w-28"
                  data-testid="pong-replay-back-button"
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
          </PongBoard>
        </GameBoardStage>
      </GameBoardColumn>
    </GameShell>
  );
}
