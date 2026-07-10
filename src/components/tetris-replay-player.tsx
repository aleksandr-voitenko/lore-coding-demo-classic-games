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
import { TetrisBoard } from "@/components/tetris-board";
import { TetrisNextPiecePreview } from "@/components/tetris-next-piece-preview";
import { Button } from "@/components/ui/button";
import type { TetrisGameState } from "@/lib/tetris-game-engine";
import {
  applyTetrisReplayEvent,
  createInitialTetrisReplayGame,
  createTetrisReplayLeaderboardKey,
  fetchTetrisReplay,
  type TetrisReplayEvent,
  type TetrisReplayPayload,
} from "@/lib/tetris-replay";

type TetrisReplayPlayerProps = {
  onBackToProfile: () => void;
};

type PlaybackState = GameReplayTimedPlayback & {
  eventIndex: number;
  events: TetrisReplayEvent[];
  random: () => number;
};

const statusLabels = {
  failed: "Replay unavailable",
  loading: "Loading replay",
  playing: "Replay playing",
  ready: "Replay ready",
} as const;

function TetrisReplayMessage({
  message,
  onBackToProfile,
  status,
}: {
  message: string;
  onBackToProfile: () => void;
  status: string;
}) {
  return (
    <GameShell className="bg-[var(--tetris-page)] text-[var(--tetris-ink)]">
      <div className="mx-auto flex min-h-[60svh] w-full max-w-md flex-col items-center justify-center gap-4 rounded-md border border-[var(--tetris-border)] bg-[var(--tetris-panel)] p-6 text-center shadow-sm">
        <GameHeader status={status} statusTestId="tetris-replay-status" title="Tetris replay" />
        <p className="text-lg font-semibold tracking-normal">{message}</p>
        <Button onClick={onBackToProfile} type="button" variant="secondary">
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
      </div>
    </GameShell>
  );
}

export function TetrisReplayPlayer({ onBackToProfile }: TetrisReplayPlayerProps) {
  const initializeReplay = useCallback(
    (latestReplay: TetrisReplayPayload) => {
      const initialReplay = createInitialTetrisReplayGame(latestReplay);

      return {
        game: initialReplay.game,
        playback: {
          eventIndex: 0,
          events: latestReplay.events,
          lastElapsedMs: 0,
          random: initialReplay.random,
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
      game: TetrisGameState;
      playback: PlaybackState;
    }) => {
      let nextGame = game;
      let lastElapsedMs: number | null = null;
      let processedAdvance = false;
      const frameElapsedMs = getReplayEventElapsedMs(
        playback.events[playback.eventIndex],
      );
      const isTimedFrame = frameElapsedMs !== null;

      while (
        playback.eventIndex < playback.events.length &&
        (isTimedFrame || !processedAdvance)
      ) {
        const event = playback.events[playback.eventIndex]!;

        if (isFutureReplayEventFrame(frameElapsedMs, event)) {
          break;
        }

        playback.eventIndex += 1;
        nextGame = applyTetrisReplayEvent(nextGame, event, playback.random);
        lastElapsedMs = getReplayEventElapsedMs(event) ?? lastElapsedMs;
        processedAdvance = isTimedFrame ? false : event.type === "advance";
      }

      playback.lastElapsedMs = lastElapsedMs ?? playback.lastElapsedMs;

      return {
        game: nextGame,
        isFinished:
          playback.eventIndex >= playback.events.length || nextGame.status === "lost",
      };
    },
    [],
  );
  const canAdvanceReplay = useCallback(
    ({ game }: { game: TetrisGameState; playback: PlaybackState }) =>
      game.status === "running",
    [],
  );

  const { game, isFinished, loadStatus, replay } = useGameReplayPlayback({
    advanceFrame: advanceReplayFrame,
    canAdvance: canAdvanceReplay,
    initializeReplay,
    loadReplay: fetchTetrisReplay,
  });
  const leaderboardKey =
    replay?.leaderboardKey ??
    createTetrisReplayLeaderboardKey({
      boardHeight: 20,
      boardWidth: 10,
      startLevel: 1,
    });
  const { finalLeaderboardProps } = useGameLeaderboardPresenter({
    leaderboardKey,
    pendingScore: null,
    testIdPrefix: "tetris-replay",
  });
  const { requestBackToMenu } = useGameEscapeToMenu({
    isGameStarted: false,
    onBackToMenu: onBackToProfile,
  });

  if (loadStatus === "loading") {
    return (
      <TetrisReplayMessage
        message="Loading Tetris replay"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={statusLabels.loading}
      />
    );
  }

  if (loadStatus === "failed" || game === null) {
    return (
      <TetrisReplayMessage
        message="No Tetris replay is available"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={statusLabels.failed}
      />
    );
  }

  return (
    <GameShell className="bg-[var(--tetris-page)] text-[var(--tetris-ink)]">
      <GameBoardColumn className="w-[min(86vw,22.25rem,calc(50svh_-_6rem))]">
        <GameSidebar className="border-[var(--tetris-border)] bg-[var(--tetris-panel)]">
          <GameHeader
            status={isFinished ? "Replay finished" : statusLabels.playing}
            statusTestId="tetris-replay-status"
            title="Tetris replay"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--tetris-border)]"
              label="Score"
              labelClassName="text-[var(--tetris-muted)]"
              value={game.score}
              valueTestId="tetris-replay-score"
            />
            <GameStatCard
              className="border-[var(--tetris-border)]"
              label="Lines"
              labelClassName="text-[var(--tetris-muted)]"
              value={game.lines}
              valueTestId="tetris-replay-lines"
            />
            <GameStatCard
              className="border-[var(--tetris-border)]"
              label="Level"
              labelClassName="text-[var(--tetris-muted)]"
              value={game.level}
              valueTestId="tetris-replay-level"
            />
            <div className="flex min-w-0 flex-col gap-2 rounded-md border border-[var(--tetris-border)] p-2 sm:p-3">
              <dt className="text-xs font-medium text-[var(--tetris-muted)]">Next</dt>
              <dd>
                <TetrisNextPiecePreview
                  kind={game.nextPieceKind}
                  testId="tetris-replay-next-piece"
                />
              </dd>
            </div>
          </GameStatsBar>
        </GameSidebar>

        <GameBoardStage
          actions={
            <GameBoardActions
              onBackToMenu={requestBackToMenu}
              testIdPrefix="tetris-replay"
            />
          }
        >
          <TetrisBoard
            game={game}
            statusLabel={isFinished ? "Replay finished" : "Replay playing"}
          >
            {isFinished ? (
              <GameEndScreen
                className="gap-3 px-3 py-4"
                testId="tetris-replay-finished-screen"
              >
                <div className="flex flex-col items-center gap-1">
                  <p className="text-2xl font-semibold tracking-normal text-balance sm:text-3xl">
                    Replay finished
                  </p>
                  <p className="text-xs font-semibold text-[#cbd5e1] sm:text-sm">
                    Final score:
                  </p>
                  <p
                    className="font-mono text-4xl font-semibold leading-none sm:text-5xl"
                    data-testid="tetris-replay-final-score"
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
                  data-testid="tetris-replay-back-button"
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
          </TetrisBoard>
        </GameBoardStage>
      </GameBoardColumn>
    </GameShell>
  );
}
