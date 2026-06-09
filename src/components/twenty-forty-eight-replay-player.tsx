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
import { TwentyFortyEightBoard } from "@/components/twenty-forty-eight-board";
import { Button } from "@/components/ui/button";
import {
  getTwentyFortyEightTopTile,
  type TwentyFortyEightGameState,
} from "@/lib/twenty-forty-eight-game-engine";
import {
  applyTwentyFortyEightReplayEvent,
  createInitialTwentyFortyEightReplayGame,
  createTwentyFortyEightReplayLeaderboardKey,
  fetchTwentyFortyEightReplay,
  type TwentyFortyEightReplayEvent,
  type TwentyFortyEightReplayPayload,
} from "@/lib/twenty-forty-eight-replay";

type TwentyFortyEightReplayPlayerProps = {
  onBackToProfile: () => void;
};

type PlaybackState = {
  eventIndex: number;
  events: TwentyFortyEightReplayEvent[];
  random: () => number;
};

const TWENTY_FORTY_EIGHT_REPLAY_STEP_MS = 420;

const statusLabels = {
  failed: "Replay unavailable",
  loading: "Loading replay",
  playing: "Replay playing",
  ready: "Replay ready",
} as const;

function TwentyFortyEightReplayMessage({
  message,
  onBackToProfile,
  status,
}: {
  message: string;
  onBackToProfile: () => void;
  status: string;
}) {
  return (
    <GameShell className="bg-[var(--twenty-page)] text-[var(--twenty-ink)]">
      <div className="mx-auto flex min-h-[60svh] w-full max-w-md flex-col items-center justify-center gap-4 rounded-md border border-[var(--twenty-border)] bg-[var(--twenty-panel)] p-6 text-center shadow-sm">
        <GameHeader
          status={status}
          statusTestId="twenty-forty-eight-replay-status"
          title="2048 replay"
        />
        <p className="text-lg font-semibold tracking-normal text-black">{message}</p>
        <Button onClick={onBackToProfile} type="button" variant="secondary">
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
      </div>
    </GameShell>
  );
}

export function TwentyFortyEightReplayPlayer({
  onBackToProfile,
}: TwentyFortyEightReplayPlayerProps) {
  const [game, setGame] = useState<TwentyFortyEightGameState | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"failed" | "loading" | "ready">("loading");
  const [replay, setReplay] = useState<TwentyFortyEightReplayPayload | null>(null);
  const gameRef = useRef<TwentyFortyEightGameState | null>(null);
  const playbackRef = useRef<PlaybackState | null>(null);
  const leaderboardKey =
    replay?.leaderboardKey ??
    createTwentyFortyEightReplayLeaderboardKey({
      boardSize: 4,
      winTile: 2048,
    });
  const { finalLeaderboardProps } = useGameLeaderboardPresenter({
    leaderboardKey,
    pendingScore: null,
    testIdPrefix: "twenty-forty-eight-replay",
  });
  const { requestBackToMenu } = useGameEscapeToMenu({
    isGameStarted: false,
    onBackToMenu: onBackToProfile,
  });

  useEffect(() => {
    let isCurrent = true;

    fetchTwentyFortyEightReplay()
      .then((latestReplay) => {
        if (!isCurrent) {
          return;
        }

        const initialReplay = createInitialTwentyFortyEightReplayGame(latestReplay);

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
    let processedMove = false;

    while (playback.eventIndex < playback.events.length && !processedMove) {
      const event = playback.events[playback.eventIndex]!;

      playback.eventIndex += 1;
      nextGame = applyTwentyFortyEightReplayEvent(nextGame, event, playback.random);
      processedMove = event.type === "move";
    }

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

    const timeout = window.setTimeout(
      advanceReplayFrame,
      TWENTY_FORTY_EIGHT_REPLAY_STEP_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [advanceReplayFrame, game, isFinished, loadStatus]);

  if (loadStatus === "loading") {
    return (
      <TwentyFortyEightReplayMessage
        message="Loading 2048 replay"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={statusLabels.loading}
      />
    );
  }

  if (loadStatus === "failed" || game === null) {
    return (
      <TwentyFortyEightReplayMessage
        message="No 2048 replay is available"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={statusLabels.failed}
      />
    );
  }

  const topTile = getTwentyFortyEightTopTile(game);

  return (
    <GameShell className="bg-[var(--twenty-page)] text-[var(--twenty-ink)]">
      <GameBoardColumn className="w-[min(92vw,37.25rem,calc(100svh_-_12rem))]">
        <GameSidebar className="border-[var(--twenty-border)] bg-[var(--twenty-panel)]">
          <GameHeader
            status={isFinished ? "Replay finished" : statusLabels.playing}
            statusTestId="twenty-forty-eight-replay-status"
            title="2048 replay"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--twenty-border)]"
              label="Score"
              labelClassName="text-[var(--twenty-muted)]"
              value={game.score}
              valueTestId="twenty-forty-eight-replay-score"
            />
            <GameStatCard
              className="border-[var(--twenty-border)]"
              label="Top tile"
              labelClassName="text-[var(--twenty-muted)]"
              value={topTile}
              valueTestId="twenty-forty-eight-replay-top-tile"
            />
            <GameStatCard
              className="border-[var(--twenty-border)]"
              label="Goal"
              labelClassName="text-[var(--twenty-muted)]"
              value={game.winTile}
              valueTestId="twenty-forty-eight-replay-goal"
            />
            <GameStatCard
              className="border-[var(--twenty-border)]"
              label="Moves"
              labelClassName="text-[var(--twenty-muted)]"
              value={game.moveCount}
              valueTestId="twenty-forty-eight-replay-moves"
            />
          </GameStatsBar>
        </GameSidebar>

        <GameBoardStage
          actions={
            <GameBoardActions
              onBackToMenu={requestBackToMenu}
              testIdPrefix="twenty-forty-eight-replay"
            />
          }
        >
          <TwentyFortyEightBoard
            game={game}
            statusLabel={isFinished ? "Replay finished" : "Replay playing"}
          >
            {isFinished ? (
              <GameEndScreen
                className="gap-3 px-3 py-4"
                testId="twenty-forty-eight-replay-finished-screen"
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
                    data-testid="twenty-forty-eight-replay-final-score"
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
                  data-testid="twenty-forty-eight-replay-back-button"
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
          </TwentyFortyEightBoard>
        </GameBoardStage>
      </GameBoardColumn>
    </GameShell>
  );
}
