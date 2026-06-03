"use client";

import { useCallback } from "react";

import type {
  GameLeaderboardPanelProps,
  GameLeaderboardScoreFormProps as FullGameLeaderboardScoreFormProps,
} from "@/components/game-leaderboard";
import { useGameLeaderboard } from "@/hooks/use-game-leaderboard";
import type { LeaderboardSortDirection } from "@/lib/leaderboard";

type GameLeaderboardScoreFormProps = Omit<
  FullGameLeaderboardScoreFormProps,
  "pendingEntry"
>;

type GameLeaderboardPresenterOptions = {
  formatScore?: GameLeaderboardPanelProps["formatScore"];
  gameSessionId?: string | null;
  leaderboardKey: string;
  pendingScore: number | null;
  scoreLabel?: GameLeaderboardScoreFormProps["scoreLabel"];
  sortDirection?: LeaderboardSortDirection;
  testIdPrefix: string;
};

type GameLeaderboardPresenterPropsOptions = {
  formatScore?: GameLeaderboardPanelProps["formatScore"];
  isSaving: boolean;
  onPlayerNameChange: GameLeaderboardScoreFormProps["onPlayerNameChange"];
  onSaveScore: GameLeaderboardScoreFormProps["onSaveScore"];
  playerName: string;
  saveFailed: boolean;
  scoreLabel?: GameLeaderboardScoreFormProps["scoreLabel"];
  slots: GameLeaderboardPanelProps["slots"];
  statusMessage: GameLeaderboardPanelProps["statusMessage"];
  testIdPrefix: string;
};

export function createGameLeaderboardPresenterProps({
  formatScore,
  isSaving,
  onPlayerNameChange,
  onSaveScore,
  playerName,
  saveFailed,
  scoreLabel,
  slots,
  statusMessage,
  testIdPrefix,
}: GameLeaderboardPresenterPropsOptions) {
  const leaderboardPanelProps: GameLeaderboardPanelProps = {
    formatScore,
    slotTestIdPrefix: `${testIdPrefix}-leaderboard-slot`,
    slots,
    statusMessage,
    testId: `${testIdPrefix}-start-leaderboard`,
  };
  const finalLeaderboardProps: GameLeaderboardPanelProps = {
    formatScore,
    slotTestIdPrefix: `${testIdPrefix}-final-leaderboard-slot`,
    slots,
    statusMessage,
    testId: `${testIdPrefix}-final-leaderboard`,
  };
  const scoreFormProps: GameLeaderboardScoreFormProps = {
    formatScore,
    isSaving,
    onPlayerNameChange,
    onSaveScore,
    playerName,
    saveFailed,
    scoreLabel,
    testIdPrefix,
  };

  return {
    finalLeaderboardProps,
    leaderboardPanelProps,
    scoreFormProps,
  };
}

export function useGameLeaderboardPresenter({
  formatScore,
  gameSessionId = null,
  leaderboardKey,
  pendingScore,
  scoreLabel,
  sortDirection = "desc",
  testIdPrefix,
}: GameLeaderboardPresenterOptions) {
  const leaderboard = useGameLeaderboard({
    gameSessionId,
    leaderboardKey,
    pendingScore,
    sortDirection,
  });
  const savePendingLeaderboardScore = leaderboard.saveLeaderboardScore;
  const saveLeaderboardScore = useCallback(() => {
    void savePendingLeaderboardScore();
  }, [savePendingLeaderboardScore]);
  const presenterProps = createGameLeaderboardPresenterProps({
    formatScore,
    isSaving: leaderboard.isSavingLeaderboardScore,
    onPlayerNameChange: leaderboard.setPlayerName,
    onSaveScore: saveLeaderboardScore,
    playerName: leaderboard.playerName,
    saveFailed: leaderboard.scoreSaveFailed,
    scoreLabel,
    slots: leaderboard.leaderboardSlots,
    statusMessage: leaderboard.leaderboardStatusMessage,
    testIdPrefix,
  });

  return {
    ...leaderboard,
    ...presenterProps,
    saveLeaderboardScore,
  };
}
