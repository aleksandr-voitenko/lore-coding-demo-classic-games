"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { BattleCityBoard } from "@/components/battle-city-board";
import { BattleCityStageResults } from "@/components/battle-city-stage-results";
import { GameLeaderboardPanel } from "@/components/game-leaderboard";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
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
  type GameReplayTimedPlayback,
  useGameReplayPlayback,
} from "@/components/game-replay-playback";
import { Button } from "@/components/ui/button";
import {
  formatBattleCityStageLabel,
  getBattleCityStageResultDisplay,
  type BattleCityGameState,
} from "@/lib/battle-city-game-engine";
import {
  applyBattleCityReplayAdvanceFrame,
  applyBattleCityReplayEvent,
  createDefaultBattleCityReplayLeaderboardKey,
  createInitialBattleCityReplayGame,
  fetchBattleCityReplay,
  getBattleCityReplayAdvanceFrameBatchSize,
  getBattleCityReplayAdvanceFrameElapsedMs,
  type BattleCityReplayEvent,
  type BattleCityReplayPayload,
  type BattleCityReplayPlaybackState,
} from "@/lib/battle-city-replay";
import { getGameCatalogEntry } from "@/lib/game-catalog";

type BattleCityReplayPlayerProps = {
  onBackToProfile: () => void;
};

type PlaybackState = GameReplayTimedPlayback & {
  advanceFrameIndex: number;
  eventIndex: number;
  events: BattleCityReplayEvent[];
  replayState: BattleCityReplayPlaybackState;
};

const BATTLE_CITY_DISPLAY_NAME = getGameCatalogEntry("battle-city").label;

const replayStatusLabels = {
  failed: "Replay unavailable",
  loading: "Loading replay",
  playing: "Replay playing",
} as const;

function BattleCityReplayMessage({
  message,
  onBackToProfile,
  status,
}: {
  message: string;
  onBackToProfile: () => void;
  status: string;
}) {
  return (
    <GameShell className="bg-[var(--battle-city-page)] text-[var(--battle-city-ink)]">
      <div className="mx-auto flex min-h-[60svh] w-full max-w-md flex-col items-center justify-center gap-4 rounded-md border border-[var(--battle-city-border)] bg-[var(--battle-city-panel)] p-6 text-center shadow-sm">
        <GameHeader
          status={status}
          statusTestId="battle-city-replay-status"
          title={`${BATTLE_CITY_DISPLAY_NAME} replay`}
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

export function BattleCityReplayPlayer({
  onBackToProfile,
}: BattleCityReplayPlayerProps) {
  const [hasReplayIntegrityFailure, setHasReplayIntegrityFailure] =
    useState(false);
  const initializeReplay = useCallback(
    (latestReplay: BattleCityReplayPayload) => {
      setHasReplayIntegrityFailure(false);
      const initialReplay = createInitialBattleCityReplayGame(latestReplay);

      return {
        game: initialReplay.game,
        playback: {
          advanceFrameIndex: 0,
          eventIndex: 0,
          events: latestReplay.events,
          lastElapsedMs: 0,
          replayState: initialReplay,
        } satisfies PlaybackState,
      };
    },
    [],
  );

  const advanceReplayFrame = useCallback(
    ({ playback }: { game: BattleCityGameState; playback: PlaybackState }) => {
      const event = playback.events[playback.eventIndex];

      if (event === undefined) {
        return {
          game: playback.replayState.game,
          isFinished: true,
        };
      }

      const frameElapsedMs =
        event.type === "advance"
          ? getBattleCityReplayAdvanceFrameElapsedMs(
              event,
              playback.advanceFrameIndex,
            )
          : getReplayEventElapsedMs(event);
      let nextReplayState = playback.replayState;

      if (event.type === "advance") {
        const batchSize = getBattleCityReplayAdvanceFrameBatchSize(
          event,
          playback.advanceFrameIndex,
        );

        for (let frame = 0; frame < batchSize; frame += 1) {
          nextReplayState = applyBattleCityReplayAdvanceFrame(
            nextReplayState,
            event,
          );
          playback.advanceFrameIndex += 1;

          if (playback.advanceFrameIndex >= event.frameCount) {
            playback.advanceFrameIndex = 0;
            playback.eventIndex += 1;
            break;
          }
          if (nextReplayState.game.status === "lost") {
            break;
          }
        }
      } else {
        playback.eventIndex += 1;
        nextReplayState = applyBattleCityReplayEvent(nextReplayState, event);
      }

      playback.lastElapsedMs = frameElapsedMs ?? playback.lastElapsedMs;
      playback.replayState = nextReplayState;
      const hasConsumedEventStream =
        playback.eventIndex >= playback.events.length &&
        playback.advanceFrameIndex === 0;

      // A terminal engine state is authentic only when it lands on the replay's declared final frame.
      if (nextReplayState.game.status === "lost" && !hasConsumedEventStream) {
        setHasReplayIntegrityFailure(true);
      }

      return {
        game: nextReplayState.game,
        isFinished:
          hasConsumedEventStream ||
          nextReplayState.game.status === "lost",
      };
    },
    [],
  );

  const getNextReplayFrameEvent = useCallback((playback: PlaybackState) => {
    const event = playback.events[playback.eventIndex];

    if (event?.type !== "advance") {
      return event;
    }

    return {
      elapsedMs: getBattleCityReplayAdvanceFrameElapsedMs(
        event,
        playback.advanceFrameIndex,
      ),
      type: event.type,
    };
  }, []);

  const { game, isFinished, loadStatus, replay } = useGameReplayPlayback({
    advanceFrame: advanceReplayFrame,
    getNextFrameEvent: getNextReplayFrameEvent,
    initializeReplay,
    loadReplay: fetchBattleCityReplay,
  });
  const leaderboardKey =
    replay?.leaderboardKey ?? createDefaultBattleCityReplayLeaderboardKey();
  const { finalLeaderboardProps } = useGameLeaderboardPresenter({
    leaderboardKey,
    pendingScore: null,
    testIdPrefix: "battle-city-replay",
  });
  const { requestBackToMenu } = useGameEscapeToMenu({
    isGameStarted: false,
    onBackToMenu: onBackToProfile,
  });

  if (loadStatus === "loading") {
    return (
      <BattleCityReplayMessage
        message={`Loading ${BATTLE_CITY_DISPLAY_NAME} replay`}
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.loading}
      />
    );
  }

  if (loadStatus === "failed" || game === null) {
    return (
      <BattleCityReplayMessage
        message={`No ${BATTLE_CITY_DISPLAY_NAME} replay is available`}
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.failed}
      />
    );
  }

  if (
    isFinished &&
    replay !== null &&
    (hasReplayIntegrityFailure ||
      game.status !== replay.finalStatus ||
      game.baseAlive !== replay.finalBaseAlive ||
      game.cycle !== replay.finalCycle ||
      game.lives !== replay.finalLives ||
      game.score !== replay.finalScore ||
      game.stage !== replay.finalStage)
  ) {
    return (
      <BattleCityReplayMessage
        message={`The saved ${BATTLE_CITY_DISPLAY_NAME} replay could not be completed`}
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.failed}
      />
    );
  }

  const stageLabel = formatBattleCityStageLabel(game.stage, game.cycle);
  const stageResultDisplay = getBattleCityStageResultDisplay(game);
  const enemiesRemaining = Math.max(
    0,
    game.totalEnemyCount - game.spawnedEnemyCount,
  );
  const statusLabel = isFinished
    ? "Replay finished"
    : replayStatusLabels.playing;

  return (
    <GameShell className="bg-[var(--battle-city-page)] text-[var(--battle-city-ink)]">
      <GameBoardColumn className="w-[min(92vw,42rem,calc(100svh_-_12rem))]">
        <GameSidebar className="border-[var(--battle-city-border)] bg-[var(--battle-city-panel)]">
          <GameHeader
            status={statusLabel}
            statusTestId="battle-city-replay-status"
            title={`${BATTLE_CITY_DISPLAY_NAME} replay`}
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--battle-city-border)]"
              label="Score"
              labelClassName="text-[var(--battle-city-muted)]"
              value={game.score.toLocaleString("en-US")}
              valueTestId="battle-city-replay-score"
            />
            <GameStatCard
              className="border-[var(--battle-city-border)]"
              label="Stage"
              labelClassName="text-[var(--battle-city-muted)]"
              value={stageLabel}
              valueTestId="battle-city-replay-stage"
            />
            <GameStatCard
              className="border-[var(--battle-city-border)]"
              label="Lives"
              labelClassName="text-[var(--battle-city-muted)]"
              value={Math.max(0, game.lives - 1)}
              valueTestId="battle-city-replay-lives"
            />
            <GameStatCard
              className="border-[var(--battle-city-border)]"
              label="Waiting"
              labelClassName="text-[var(--battle-city-muted)]"
              value={enemiesRemaining}
              valueTestId="battle-city-replay-enemies-remaining"
            />
          </GameStatsBar>
        </GameSidebar>

        <GameBoardStage
          actions={
            <GameBoardActions
              onBackToMenu={requestBackToMenu}
              testIdPrefix="battle-city-replay"
            />
          }
        >
          <BattleCityBoard game={game}>
            {isFinished ? (
              <GameEndScreen
                className="gap-3 px-3 py-4"
                testId="battle-city-replay-finished-screen"
              >
                <div className="flex flex-col items-center gap-1">
                  <p className="text-2xl font-semibold tracking-normal text-balance sm:text-3xl">
                    {game.baseAlive ? "Out of tanks" : "Headquarters destroyed"}
                  </p>
                  <p className="text-xs font-semibold text-[var(--battle-city-muted)] sm:text-sm">
                    Final score:
                  </p>
                  <p
                    className="font-mono text-4xl font-semibold leading-none sm:text-5xl"
                    data-testid="battle-city-replay-final-score"
                  >
                    {game.score.toLocaleString("en-US")}
                  </p>
                </div>
                <GameLeaderboardPanel
                  {...finalLeaderboardProps}
                  className="max-w-[17rem] p-2 sm:max-w-xs sm:p-3"
                />
                <Button
                  className="min-w-28"
                  data-testid="battle-city-replay-back-button"
                  onClick={requestBackToMenu ?? onBackToProfile}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
              </GameEndScreen>
            ) : game.status === "stage-results" ? (
              <BattleCityStageResults
                killCounts={stageResultDisplay.killCounts}
                score={game.score}
                showTotal={stageResultDisplay.showTotal}
                stage={Number(stageLabel)}
              />
            ) : game.status === "stage-intro" ? (
              <BattleCityReplayStatusOverlay title={`STAGE ${stageLabel}`} />
            ) : game.status === "game-over" ? (
              <BattleCityReplayStatusOverlay title="GAME OVER" />
            ) : null}
          </BattleCityBoard>
        </GameBoardStage>
      </GameBoardColumn>
    </GameShell>
  );
}

function BattleCityReplayStatusOverlay({ title }: { title: string }) {
  return (
    <div className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--battle-city-board)_78%,transparent)] text-center text-[var(--battle-city-board-text)] backdrop-blur-[2px]">
      <p className="text-2xl font-semibold tracking-normal">{title}</p>
    </div>
  );
}
