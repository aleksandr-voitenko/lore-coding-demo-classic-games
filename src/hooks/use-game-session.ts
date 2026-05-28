"use client";

import { useEffect, useRef, useState } from "react";

import { useCurrentUser } from "@/hooks/use-current-user";
import { submitGameSession, type GameSessionResult } from "@/lib/user-profile";
import type { LeaderboardSortDirection } from "@/lib/leaderboard";

type UseGameSessionOptions = {
  active: boolean;
  finalResult: Exclude<GameSessionResult, "abandoned"> | null;
  finalScore: number;
  gameId: string;
  leaderboardKey: string;
  sortDirection?: LeaderboardSortDirection;
  started: boolean;
};

function getNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export function useGameSession({
  active,
  finalResult,
  finalScore,
  gameId,
  leaderboardKey,
  sortDirection = "desc",
  started,
}: UseGameSessionOptions) {
  const { user } = useCurrentUser();
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);
  const accumulatedMsRef = useRef(0);
  const activeStartedAtRef = useRef<number | null>(null);
  const latestSubmissionRef = useRef({
    finalResult,
    finalScore,
    gameId,
    leaderboardKey,
    sortDirection,
    started,
    userId: user?.id ?? null,
  });
  const submittedRef = useRef(false);
  const wasTerminalRef = useRef(false);

  useEffect(() => {
    latestSubmissionRef.current = {
      finalResult,
      finalScore,
      gameId,
      leaderboardKey,
      sortDirection,
      started,
      userId: user?.id ?? null,
    };
  }, [finalResult, finalScore, gameId, leaderboardKey, sortDirection, started, user?.id]);

  useEffect(() => {
    if (finalResult === null && wasTerminalRef.current) {
      accumulatedMsRef.current = 0;
      activeStartedAtRef.current = null;
      submittedRef.current = false;
      setCompletedSessionId(null);
      wasTerminalRef.current = false;
    }

    if (finalResult !== null) {
      wasTerminalRef.current = true;
    }
  }, [finalResult]);

  useEffect(() => {
    if (!user || !started) {
      activeStartedAtRef.current = null;
      return;
    }

    if (active && activeStartedAtRef.current === null) {
      activeStartedAtRef.current = getNow();
      return;
    }

    if (!active && activeStartedAtRef.current !== null) {
      accumulatedMsRef.current += getNow() - activeStartedAtRef.current;
      activeStartedAtRef.current = null;
    }
  }, [active, started, user]);

  useEffect(() => {
    if (!user || !started || finalResult === null || submittedRef.current) {
      return;
    }

    submittedRef.current = true;

    const activeStartedAt = activeStartedAtRef.current;
    const activeDurationMs = Math.round(
      accumulatedMsRef.current + (activeStartedAt === null ? 0 : getNow() - activeStartedAt),
    );

    submitGameSession({
      activeDurationMs,
      finalScore,
      gameId,
      leaderboardKey,
      result: finalResult,
      sortDirection,
    })
      .then((session) => setCompletedSessionId(session.id))
      .catch(() => {
        submittedRef.current = false;
      });
  }, [finalResult, finalScore, gameId, leaderboardKey, sortDirection, started, user]);

  useEffect(
    () => () => {
      const latestSubmission = latestSubmissionRef.current;

      if (
        submittedRef.current ||
        latestSubmission.userId === null ||
        !latestSubmission.started ||
        latestSubmission.finalResult !== null
      ) {
        return;
      }

      const activeStartedAt = activeStartedAtRef.current;
      const activeDurationMs = Math.round(
        accumulatedMsRef.current + (activeStartedAt === null ? 0 : getNow() - activeStartedAt),
      );

      if (activeDurationMs <= 0) {
        return;
      }

      submittedRef.current = true;

      void submitGameSession(
        {
          activeDurationMs,
          finalScore: latestSubmission.finalScore,
          gameId: latestSubmission.gameId,
          leaderboardKey: latestSubmission.leaderboardKey,
          result: "abandoned",
          sortDirection: latestSubmission.sortDirection,
        },
        { keepalive: true },
      ).catch(() => {
        submittedRef.current = false;
      });
    },
    [],
  );

  return {
    completedSessionId,
  };
}
