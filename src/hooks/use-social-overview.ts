"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { fetchSocialOverview } from "@/lib/social-client";
import type { SocialOverview } from "@/lib/social";

export const SOCIAL_OVERVIEW_POLL_INTERVAL_MS = 30_000;

type SocialOverviewFetcher = () => Promise<SocialOverview>;

export type SocialOverviewState = {
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
  overview: SocialOverview | null;
};

type AccountSocialOverviewState = SocialOverviewState & {
  userId: string | null;
};

type UseSocialOverviewOptions = {
  fetchOverview?: SocialOverviewFetcher;
  pollIntervalMs?: number;
};

const EMPTY_SOCIAL_OVERVIEW_STATE: SocialOverviewState = {
  error: null,
  isLoading: false,
  isRefreshing: false,
  overview: null,
};

function getInitialSocialOverviewState(
  userId: string | null,
): AccountSocialOverviewState {
  return userId === null
    ? { ...EMPTY_SOCIAL_OVERVIEW_STATE, userId }
    : {
        ...EMPTY_SOCIAL_OVERVIEW_STATE,
        isLoading: true,
        userId,
      };
}

function normalizePollIntervalMs(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Social overview poll interval must be a positive integer.");
  }

  return value;
}

/**
 * Keeps the last valid social graph visible while a newer overview is loading.
 * Every request receives a generation so a late focus or polling response cannot
 * replace data fetched after a relationship mutation or account change.
 */
export function useSocialOverview(
  userId: string | null,
  {
    fetchOverview = fetchSocialOverview,
    pollIntervalMs = SOCIAL_OVERVIEW_POLL_INTERVAL_MS,
  }: UseSocialOverviewOptions = {},
) {
  const normalizedPollIntervalMs = normalizePollIntervalMs(pollIntervalMs);
  const [state, setState] = useState<AccountSocialOverviewState>(() =>
    getInitialSocialOverviewState(userId),
  );
  const accountGenerationRef = useRef(0);
  const fetchOverviewRef = useRef(fetchOverview);
  const inFlightRequestRef = useRef<Promise<SocialOverview | null> | null>(null);
  const requestGenerationRef = useRef(0);
  const activeUserIdRef = useRef(userId);

  useEffect(() => {
    fetchOverviewRef.current = fetchOverview;
  }, [fetchOverview]);

  const requestOverview = useCallback((coalesce: boolean) => {
    if (userId === null) {
      return Promise.resolve(null);
    }

    if (coalesce && inFlightRequestRef.current !== null) {
      return inFlightRequestRef.current;
    }

    const accountGeneration = accountGenerationRef.current;
    const requestGeneration = requestGenerationRef.current + 1;

    requestGenerationRef.current = requestGeneration;
    setState((currentState) =>
      currentState.userId === userId
        ? {
            ...currentState,
            error: null,
            isLoading: currentState.overview === null,
            isRefreshing: currentState.overview !== null,
          }
        : getInitialSocialOverviewState(userId),
    );

    const request = (async () => {
      try {
        const overview = await fetchOverviewRef.current();

        if (
          activeUserIdRef.current !== userId ||
          accountGenerationRef.current !== accountGeneration ||
          requestGenerationRef.current !== requestGeneration
        ) {
          return null;
        }

        setState({
          error: null,
          isLoading: false,
          isRefreshing: false,
          overview,
          userId,
        });
        return overview;
      } catch (error) {
        if (
          activeUserIdRef.current !== userId ||
          accountGenerationRef.current !== accountGeneration ||
          requestGenerationRef.current !== requestGeneration
        ) {
          return null;
        }

        const normalizedError =
          error instanceof Error ? error : new Error("Friends are unavailable.");

        setState((currentState) =>
          currentState.userId === userId
            ? {
                ...currentState,
                error: normalizedError,
                isLoading: false,
                isRefreshing: false,
              }
            : {
                ...getInitialSocialOverviewState(userId),
                error: normalizedError,
                isLoading: false,
              },
        );
        return null;
      }
    })();

    inFlightRequestRef.current = request;
    void request.finally(() => {
      if (inFlightRequestRef.current === request) {
        inFlightRequestRef.current = null;
      }
    });

    return request;
  }, [userId]);

  const refresh = useCallback(() => requestOverview(false), [requestOverview]);
  const refreshPassively = useCallback(
    () => requestOverview(true),
    [requestOverview],
  );

  useEffect(() => {
    activeUserIdRef.current = userId;
    accountGenerationRef.current += 1;
    inFlightRequestRef.current = null;
    requestGenerationRef.current += 1;

    if (userId !== null) {
      void refreshPassively();
    }

    return () => {
      accountGenerationRef.current += 1;
      requestGenerationRef.current += 1;
    };
  }, [refreshPassively, userId]);

  useEffect(() => {
    if (userId === null || typeof document === "undefined") {
      return;
    }

    let pollTimeout: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const clearPoll = () => {
      if (pollTimeout !== null) {
        clearTimeout(pollTimeout);
        pollTimeout = null;
      }
    };

    const schedulePoll = () => {
      clearPoll();

      if (stopped || document.visibilityState !== "visible") {
        return;
      }

      pollTimeout = setTimeout(() => {
        pollTimeout = null;
        void refreshPassively().finally(schedulePoll);
      }, normalizedPollIntervalMs);
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") {
        clearPoll();
        return;
      }

      void refreshPassively().finally(schedulePoll);
    };

    const handleVisibilityChange = () => {
      refreshWhenVisible();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", refreshWhenVisible);
    schedulePoll();

    return () => {
      stopped = true;
      clearPoll();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [normalizedPollIntervalMs, refreshPassively, userId]);

  const scopedState =
    state.userId === userId ? state : getInitialSocialOverviewState(userId);

  return {
    error: scopedState.error,
    isLoading: scopedState.isLoading,
    isRefreshing: scopedState.isRefreshing,
    overview: scopedState.overview,
    refresh,
  };
}

export function getSocialPendingCount(overview: SocialOverview | null) {
  return overview === null
    ? 0
    : overview.incomingFriendRequests.length +
        overview.incomingPartyInvitations.length;
}
