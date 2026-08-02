"use client";

import {
  createContext,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  getSocialPendingCount,
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

type SocialContextValue = {
  availability: SocialAvailability;
  closeSocialCenter: () => void;
  isLoading: boolean;
  isMutationPending: (key: string) => boolean;
  isRefreshing: boolean;
  isSocialCenterOpen: boolean;
  openSocialCenter: () => void;
  overview: SocialOverview | null;
  overviewError: Error | null;
  pendingCount: number;
  presenceError: Error | null;
  refresh: () => Promise<SocialOverview | null>;
  runMutation: SocialMutationRunner;
  setSocialCenterOpen: (open: boolean) => void;
};

const EMPTY_PENDING_MUTATIONS = new Set<string>();

type AccountSocialCenterState = {
  open: boolean;
  userId: string | null;
};

const SocialContext = createContext<SocialContextValue>({
  availability: "offline",
  closeSocialCenter: () => {},
  isLoading: false,
  isMutationPending: () => false,
  isRefreshing: false,
  isSocialCenterOpen: false,
  openSocialCenter: () => {},
  overview: null,
  overviewError: null,
  pendingCount: 0,
  presenceError: null,
  refresh: async () => null,
  runMutation: async (_key, mutation) => mutation(),
  setSocialCenterOpen: () => {},
});

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
  const socialUserId = enabled ? userId : null;
  const {
    error: overviewError,
    isLoading,
    isRefreshing,
    overview,
    refresh,
  } = useSocialOverview(socialUserId);
  const {
    availability,
    error: presenceError,
  } = useSocialPresence(socialUserId, presenceState);
  const [socialCenterState, setSocialCenterState] =
    useState<AccountSocialCenterState>({ open: false, userId });
  const [mutationCoordinator] = useState(
    () => new SocialMutationCoordinator({ accountEpoch, userId }),
  );
  const mutationSnapshot = useSyncExternalStore(
    mutationCoordinator.subscribe,
    mutationCoordinator.getSnapshot,
    mutationCoordinator.getSnapshot,
  );

  useLayoutEffect(() => {
    mutationCoordinator.setAccount({ accountEpoch, userId });
  }, [accountEpoch, mutationCoordinator, userId]);

  const pendingMutations =
    mutationSnapshot.accountEpoch === accountEpoch &&
    mutationSnapshot.userId === userId
      ? mutationSnapshot.pendingKeys
      : EMPTY_PENDING_MUTATIONS;
  const isSocialCenterOpen =
    socialCenterState.userId === userId && socialCenterState.open;
  const pendingCount = getSocialPendingCount(overview);

  const setSocialCenterOpen = useCallback(
    (open: boolean) => {
      setSocialCenterState({ open, userId });
    },
    [userId],
  );

  const runMutation = useCallback<SocialMutationRunner>(
    async (key, mutation) => {
      const mutationAccount = { accountEpoch, userId };

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
          isAccountEpochCurrent(accountEpoch) &&
          currentSnapshot.accountEpoch === accountEpoch &&
          currentSnapshot.userId === userId
        ) {
          void refresh();
        }
      }
    },
    [
      accountEpoch,
      isAccountEpochCurrent,
      mutationCoordinator,
      refresh,
      userId,
    ],
  );

  const isMutationPending = useCallback(
    (key: string) => pendingMutations.has(key),
    [pendingMutations],
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
      availability,
      closeSocialCenter,
      isLoading,
      isMutationPending,
      isRefreshing,
      isSocialCenterOpen,
      openSocialCenter,
      overview,
      overviewError,
      pendingCount,
      presenceError,
      refresh,
      runMutation,
      setSocialCenterOpen,
    }),
    [
      availability,
      closeSocialCenter,
      isLoading,
      isMutationPending,
      isRefreshing,
      isSocialCenterOpen,
      openSocialCenter,
      overview,
      overviewError,
      pendingCount,
      presenceError,
      refresh,
      runMutation,
      setSocialCenterOpen,
    ],
  );

  return (
    <SocialContext.Provider value={contextValue}>
      {children}
    </SocialContext.Provider>
  );
}
