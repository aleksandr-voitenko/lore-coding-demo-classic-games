import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createPendingLeaderboardEntry,
  fetchLeaderboard,
  LEADERBOARD_LIMIT,
  submitLeaderboardScore,
  type LeaderboardEntry,
  type LeaderboardSortDirection,
} from "@/lib/leaderboard";

type UseGameLeaderboardOptions = {
  leaderboardKey: string;
  pendingScore: number | null;
  sortDirection?: LeaderboardSortDirection;
};

export function useGameLeaderboard({
  leaderboardKey,
  pendingScore,
  sortDirection = "desc",
}: UseGameLeaderboardOptions) {
  const [isSavingLeaderboardScore, setIsSavingLeaderboardScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoadFailed, setLeaderboardLoadFailed] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [scoreSaveFailed, setScoreSaveFailed] = useState(false);
  const [savedPendingScoreKey, setSavedPendingScoreKey] = useState<string | null>(null);
  const pendingScoreKey =
    pendingScore === null ? null : `${leaderboardKey}|sort=${sortDirection}|score=${pendingScore}`;
  const hasSavedPendingScore =
    pendingScoreKey !== null && savedPendingScoreKey === pendingScoreKey;
  const leaderboardBestScore = leaderboard[0]?.score ?? 0;
  const leaderboardStatusMessage = leaderboardLoadFailed ? "Leaderboard unavailable" : undefined;
  const leaderboardSlots = useMemo(
    () => Array.from({ length: LEADERBOARD_LIMIT }, (_, index) => leaderboard[index] ?? null),
    [leaderboard],
  );
  const pendingLeaderboardEntry = useMemo(
    () =>
      pendingScore === null || hasSavedPendingScore
        ? null
        : createPendingLeaderboardEntry(pendingScore, leaderboard, sortDirection),
    [hasSavedPendingScore, leaderboard, pendingScore, sortDirection],
  );

  const resetLeaderboardForm = useCallback(() => {
    setPlayerName("");
    setScoreSaveFailed(false);
    setSavedPendingScoreKey(null);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    fetchLeaderboard({ leaderboardKey, sortDirection })
      .then((nextLeaderboard) => {
        if (!isCurrent) {
          return;
        }

        setLeaderboard(nextLeaderboard);
        setLeaderboardLoadFailed(false);
      })
      .catch(() => {
        if (isCurrent) {
          setLeaderboardLoadFailed(true);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [leaderboardKey, sortDirection]);

  const saveLeaderboardScore = useCallback(async () => {
    if (pendingLeaderboardEntry === null || pendingScoreKey === null || isSavingLeaderboardScore) {
      return;
    }

    setIsSavingLeaderboardScore(true);
    setScoreSaveFailed(false);

    try {
      const result = await submitLeaderboardScore({
        leaderboardKey,
        name: playerName,
        score: pendingLeaderboardEntry.score,
        sortDirection,
      });

      setLeaderboard(result.entries);
      setLeaderboardLoadFailed(false);
      setSavedPendingScoreKey(pendingScoreKey);
      setPlayerName("");
    } catch {
      setLeaderboardLoadFailed(true);
      setScoreSaveFailed(true);
    } finally {
      setIsSavingLeaderboardScore(false);
    }
  }, [
    isSavingLeaderboardScore,
    leaderboardKey,
    pendingLeaderboardEntry,
    pendingScoreKey,
    playerName,
    sortDirection,
  ]);

  return {
    isSavingLeaderboardScore,
    leaderboard,
    leaderboardBestScore,
    leaderboardSlots,
    leaderboardStatusMessage,
    pendingLeaderboardEntry,
    playerName,
    resetLeaderboardForm,
    saveLeaderboardScore,
    scoreSaveFailed,
    setPlayerName,
  };
}
