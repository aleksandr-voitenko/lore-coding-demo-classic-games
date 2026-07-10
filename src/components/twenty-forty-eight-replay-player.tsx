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
import { TwentyFortyEightBoard } from "@/components/twenty-forty-eight-board";
import { Button } from "@/components/ui/button";
import type { TwentyFortyEightGameState } from "@/lib/twenty-forty-eight-game-engine";
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

type PlaybackState = GameReplayTimedPlayback & {
  eventIndex: number;
  events: TwentyFortyEightReplayEvent[];
  random: () => number;
};

type AdvanceTwentyFortyEightReplayFrameInput = Pick<
  PlaybackState,
  "eventIndex" | "events" | "random"
> & {
  game: TwentyFortyEightGameState;
};

type AdvanceTwentyFortyEightReplayFrameResult = {
  eventIndex: number;
  game: TwentyFortyEightGameState;
  isFinished: boolean;
  lastElapsedMs: number | null;
};

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
        <p className="text-lg font-semibold tracking-normal">{message}</p>
        <Button onClick={onBackToProfile} type="button" variant="secondary">
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
      </div>
    </GameShell>
  );
}

export function advanceTwentyFortyEightReplayFrame({
  eventIndex,
  events,
  game,
  random,
}: AdvanceTwentyFortyEightReplayFrameInput): AdvanceTwentyFortyEightReplayFrameResult {
  let nextEventIndex = eventIndex;
  let nextGame = game;
  let hasVisibleChange = false;
  let lastElapsedMs: number | null = null;
  // Timed payloads consume one elapsed boundary; untimed payloads stop after a visible board change.
  const frameElapsedMs = getReplayEventElapsedMs(events[eventIndex]);
  const isTimedFrame = frameElapsedMs !== null;

  while (nextEventIndex < events.length && (isTimedFrame || !hasVisibleChange)) {
    const event = events[nextEventIndex]!;
    const previousGame = nextGame;

    if (isFutureReplayEventFrame(frameElapsedMs, event)) {
      break;
    }

    nextEventIndex += 1;
    nextGame = applyTwentyFortyEightReplayEvent(nextGame, event, random);
    lastElapsedMs = getReplayEventElapsedMs(event) ?? lastElapsedMs;
    hasVisibleChange = isTimedFrame ? false : nextGame !== previousGame;

    if (nextGame.status === "lost" || nextGame.status === "won") {
      break;
    }
  }

  return {
    eventIndex: nextEventIndex,
    game: nextGame,
    isFinished:
      nextEventIndex >= events.length || nextGame.status === "lost" || nextGame.status === "won",
    lastElapsedMs,
  };
}

export function TwentyFortyEightReplayPlayer({
  onBackToProfile,
}: TwentyFortyEightReplayPlayerProps) {
  const initializeReplay = useCallback(
    (latestReplay: TwentyFortyEightReplayPayload) => {
      const initialReplay = createInitialTwentyFortyEightReplayGame(latestReplay);

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
      game: TwentyFortyEightGameState;
      playback: PlaybackState;
    }) => {
      const nextFrame = advanceTwentyFortyEightReplayFrame({
        eventIndex: playback.eventIndex,
        events: playback.events,
        game,
        random: playback.random,
      });

      playback.eventIndex = nextFrame.eventIndex;
      playback.lastElapsedMs = nextFrame.lastElapsedMs ?? playback.lastElapsedMs;

      return {
        game: nextFrame.game,
        isFinished: nextFrame.isFinished,
      };
    },
    [],
  );

  const { game, isFinished, loadStatus, replay } = useGameReplayPlayback({
    advanceFrame: advanceReplayFrame,
    initializeReplay,
    loadReplay: fetchTwentyFortyEightReplay,
  });
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
