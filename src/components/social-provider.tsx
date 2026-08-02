"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  getSocialPendingCount,
  type SocialOverviewRefreshResult,
  useSocialOverview,
} from "@/hooks/use-social-overview";
import {
  useSocialPresence,
  type BrowserSocialPresenceState,
} from "@/hooks/use-social-presence";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { SocialAvailability, SocialOverview } from "@/lib/social";
import { SocialMutationCoordinator } from "@/lib/social-mutation-coordinator";

export type SocialMutationRunner = <Result>(
  key: string,
  mutation: () => Promise<Result>,
) => Promise<Result>;

export type SocialContextValue = {
  availability: SocialAvailability;
  closeSocialCenter: () => void;
  isEnabled: boolean;
  isLoading: boolean;
  isMutationPending: (key: string) => boolean;
  isRefreshing: boolean;
  isSocialCenterOpen: boolean;
  openSocialCenter: () => void;
  overview: SocialOverview | null;
  overviewError: Error | null;
  overviewRequestGeneration: number | null;
  pendingCount: number;
  presenceError: Error | null;
  refresh: () => Promise<SocialOverview | null>;
  refreshWithGeneration: () => Promise<SocialOverviewRefreshResult>;
  runMutation: SocialMutationRunner;
  setSocialCenterOpen: (open: boolean) => void;
};

const EMPTY_PENDING_MUTATIONS = new Set<string>();

const SocialContext = createContext<SocialContextValue | null>(null);

type SocialContextData = Omit<
  SocialContextValue,
  | "closeSocialCenter"
  | "isSocialCenterOpen"
  | "openSocialCenter"
  | "setSocialCenterOpen"
>;

type AccountSocialCenterState = {
  accountKey: string;
  open: boolean;
};

type SocialProviderProps = {
  children: ReactNode;
  enabled: boolean;
  presenceState: BrowserSocialPresenceState;
};

export function SocialProvider({
  children,
  enabled,
  presenceState,
}: SocialProviderProps) {
  const { accountEpoch, isAccountEpochCurrent, user } = useCurrentUser();
  const userId = user?.id ?? null;
  const isEnabled = enabled && userId !== null;
  const socialUserId = isEnabled ? userId : null;
  const {
    error: overviewError,
    isLoading,
    isRefreshing,
    overview,
    overviewRequestGeneration,
    refresh,
    refreshWithGeneration,
  } = useSocialOverview(socialUserId);
  const {
    availability,
    error: presenceError,
  } = useSocialPresence(socialUserId, presenceState);
  const [mutationCoordinator] = useState(
    () => new SocialMutationCoordinator({ accountEpoch, userId: socialUserId }),
  );
  const mutationSnapshot = useSyncExternalStore(
    mutationCoordinator.subscribe,
    mutationCoordinator.getSnapshot,
    mutationCoordinator.getSnapshot,
  );

  useLayoutEffect(() => {
    mutationCoordinator.setAccount({ accountEpoch, userId: socialUserId });
  }, [accountEpoch, mutationCoordinator, socialUserId]);

  const pendingMutations =
    mutationSnapshot.accountEpoch === accountEpoch &&
    mutationSnapshot.userId === socialUserId
      ? mutationSnapshot.pendingKeys
      : EMPTY_PENDING_MUTATIONS;
  const pendingCount = getSocialPendingCount(overview);

  const runMutation = useCallback<SocialMutationRunner>(
    async (key, mutation) => {
      if (!enabled) {
        throw new Error("Friends are not available on this screen.");
      }

      const mutationAccount = { accountEpoch, userId: socialUserId };

      try {
        return await mutationCoordinator.run(
          mutationAccount,
          key,
          mutation,
          () => isAccountEpochCurrent(accountEpoch),
        );
      } finally {
        const currentSnapshot = mutationCoordinator.getSnapshot();

        if (
          socialUserId !== null &&
          isAccountEpochCurrent(accountEpoch) &&
          currentSnapshot.accountEpoch === accountEpoch &&
          currentSnapshot.userId === socialUserId
        ) {
          void refresh();
        }
      }
    },
    [
      accountEpoch,
      enabled,
      isAccountEpochCurrent,
      mutationCoordinator,
      refresh,
      socialUserId,
    ],
  );

  const isMutationPending = useCallback(
    (key: string) => pendingMutations.has(key),
    [pendingMutations],
  );
  const contextData = useMemo<SocialContextData>(
    () => ({
      availability: isEnabled ? availability : "offline",
      isEnabled,
      isLoading,
      isMutationPending,
      isRefreshing,
      overview,
      overviewError,
      overviewRequestGeneration,
      pendingCount,
      presenceError: isEnabled ? presenceError : null,
      refresh,
      refreshWithGeneration,
      runMutation,
    }),
    [
      availability,
      isEnabled,
      isLoading,
      isMutationPending,
      isRefreshing,
      overview,
      overviewError,
      overviewRequestGeneration,
      pendingCount,
      presenceError,
      refresh,
      refreshWithGeneration,
      runMutation,
    ],
  );

  return (
    <SocialContextScope
      accountKey={`${accountEpoch}:${socialUserId ?? "disabled"}`}
      data={contextData}
    >
      {children}
    </SocialContextScope>
  );
}

function SocialContextScope({
  accountKey,
  children,
  data,
}: {
  accountKey: string;
  children: ReactNode;
  data: SocialContextData;
}) {
  const [socialCenterState, setSocialCenterState] =
    useState<AccountSocialCenterState>({ accountKey, open: false });
  const isSocialCenterOpen =
    socialCenterState.accountKey === accountKey && socialCenterState.open;
  const setSocialCenterOpen = useCallback(
    (open: boolean) =>
      setSocialCenterState({ accountKey, open: data.isEnabled && open }),
    [accountKey, data.isEnabled],
  );
  const openSocialCenter = useCallback(
    () => setSocialCenterOpen(true),
    [setSocialCenterOpen],
  );
  const closeSocialCenter = useCallback(
    () => setSocialCenterOpen(false),
    [setSocialCenterOpen],
  );
  const contextValue = useMemo<SocialContextValue>(
    () => ({
      ...data,
      closeSocialCenter,
      isSocialCenterOpen: data.isEnabled && isSocialCenterOpen,
      openSocialCenter,
      setSocialCenterOpen,
    }),
    [
      closeSocialCenter,
      data,
      isSocialCenterOpen,
      openSocialCenter,
      setSocialCenterOpen,
    ],
  );

  return (
    <SocialContext.Provider value={contextValue}>
      {children}
    </SocialContext.Provider>
  );
}

export function useSocial() {
  const context = useContext(SocialContext);

  if (context === null) {
    throw new Error("useSocial must be used within a SocialProvider.");
  }

  return context;
}
