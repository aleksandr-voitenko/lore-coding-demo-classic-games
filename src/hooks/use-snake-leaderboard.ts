import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  LEADERBOARD_LIMIT,
  type GameState,
  type LeaderboardEntry,
  type PendingLeaderboardEntry,
} from "@/lib/snake-game-engine";
import { fetchLeaderboard, submitLeaderboardScore } from "@/lib/snake-leaderboard";

type UseSnakeLeaderboardOptions = {
  boardSize: number;
  pendingLeaderboardEntry: PendingLeaderboardEntry | null;
  setGame: Dispatch<SetStateAction<GameState>>;
};

export function useSnakeLeaderboard({
  boardSize,
  pendingLeaderboardEntry,
  setGame,
}: UseSnakeLeaderboardOptions) {
  const [isSavingLeaderboardScore, setIsSavingLeaderboardScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoadFailed, setLeaderboardLoadFailed] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [scoreSaveFailed, setScoreSaveFailed] = useState(false);
  const leaderboardBestScore = leaderboard[0]?.score ?? 0;
  const leaderboardStatusMessage = leaderboardLoadFailed ? "Leaderboard unavailable" : undefined;
  const leaderboardSlots = useMemo(
    () => Array.from({ length: LEADERBOARD_LIMIT }, (_, index) => leaderboard[index] ?? null),
    [leaderboard],
  );

  const resetLeaderboardForm = useCallback(() => {
    setPlayerName("");
    setScoreSaveFailed(false);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    fetchLeaderboard()
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
  }, []);

  const saveLeaderboardScore = useCallback(async () => {
    if (pendingLeaderboardEntry === null || isSavingLeaderboardScore) {
      return;
    }

    setIsSavingLeaderboardScore(true);
    setScoreSaveFailed(false);

    try {
      const result = await submitLeaderboardScore({
        boardSize,
        name: playerName,
        score: pendingLeaderboardEntry.score,
      });
      const nextBestScore = result.entries[0]?.score ?? 0;

      setLeaderboard(result.entries);
      setLeaderboardLoadFailed(false);
      setGame((current) => ({
        ...current,
        bestScore: Math.max(current.bestScore, nextBestScore),
        pendingLeaderboardEntry: null,
      }));
      setPlayerName("");
    } catch {
      setLeaderboardLoadFailed(true);
      setScoreSaveFailed(true);
    } finally {
      setIsSavingLeaderboardScore(false);
    }
  }, [boardSize, isSavingLeaderboardScore, pendingLeaderboardEntry, playerName, setGame]);

  return {
    isSavingLeaderboardScore,
    leaderboard,
    leaderboardBestScore,
    leaderboardSlots,
    leaderboardStatusMessage,
    playerName,
    resetLeaderboardForm,
    saveLeaderboardScore,
    scoreSaveFailed,
    setPlayerName,
  };
}
