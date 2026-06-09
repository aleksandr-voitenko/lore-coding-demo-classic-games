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
import { TetrisBoard } from "@/components/tetris-board";
import { TetrisNextPiecePreview } from "@/components/tetris-next-piece-preview";
import { Button } from "@/components/ui/button";
import { getTetrisTickDelay, type TetrisGameState } from "@/lib/tetris-game-engine";
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

type PlaybackState = {
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
        <p className="text-lg font-semibold tracking-normal text-black">{message}</p>
        <Button onClick={onBackToProfile} type="button" variant="secondary">
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
      </div>
    </GameShell>
  );
}

export function TetrisReplayPlayer({ onBackToProfile }: TetrisReplayPlayerProps) {
  const [game, setGame] = useState<TetrisGameState | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"failed" | "loading" | "ready">("loading");
  const [replay, setReplay] = useState<TetrisReplayPayload | null>(null);
  const gameRef = useRef<TetrisGameState | null>(null);
  const playbackRef = useRef<PlaybackState | null>(null);
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

  useEffect(() => {
    let isCurrent = true;

    fetchTetrisReplay()
      .then((latestReplay) => {
        if (!isCurrent) {
          return;
        }

        const initialReplay = createInitialTetrisReplayGame(latestReplay);

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

    let nextGame = currentGame;
    let processedAdvance = false;

    while (playback.eventIndex < playback.events.length && !processedAdvance) {
      const event = playback.events[playback.eventIndex]!;

      playback.eventIndex += 1;
      nextGame = applyTetrisReplayEvent(nextGame, event, playback.random);
      processedAdvance = event.type === "advance";
    }

    gameRef.current = nextGame;
    setGame(nextGame);

    if (playback.eventIndex >= playback.events.length || nextGame.status === "lost") {
      setIsFinished(true);
    }
  }, [isFinished]);

  useEffect(() => {
    if (loadStatus !== "ready" || isFinished) {
      return;
    }

    const currentGame = gameRef.current;

    if (currentGame === null || currentGame.status !== "running") {
      return;
    }

    const timeout = window.setTimeout(
      advanceReplayFrame,
      getTetrisTickDelay(currentGame.level),
    );

    return () => window.clearTimeout(timeout);
  }, [advanceReplayFrame, game, isFinished, loadStatus]);

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

  const tickDelay = game.status === "running" ? getTetrisTickDelay(game.level) : null;

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
            <GameStatCard
              className="border-[var(--tetris-border)]"
              label="Speed"
              labelClassName="text-[var(--tetris-muted)]"
              value={tickDelay === null ? "0" : `${Math.round(1000 / tickDelay)}`}
              valueTestId="tetris-replay-speed"
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
