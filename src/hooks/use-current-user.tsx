"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  fetchCurrentUser,
  logInUser,
  signOutUser,
  signUpUser,
  type AuthenticatedUser,
} from "@/lib/user-profile";
import {
  releaseCurrentSocialPresenceLease,
  resumeCurrentSocialPresenceLease,
} from "@/lib/social-presence-client";

type CurrentUserContextValue = {
  accountEpoch: number;
  isLoading: boolean;
  isAccountEpochCurrent: (accountEpoch: number) => boolean;
  logIn: (displayName: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (
    displayName: string,
    password: string,
    passwordConfirmation: string,
  ) => Promise<void>;
  user: AuthenticatedUser | null;
  userError: boolean;
};

const CurrentUserContext = createContext<CurrentUserContextValue>({
  accountEpoch: 0,
  isLoading: false,
  isAccountEpochCurrent: () => false,
  logIn: async () => {},
  signOut: async () => {},
  signUp: async () => {},
  user: null,
  userError: false,
});

type CurrentUserProviderProps = {
  children: ReactNode;
  initialUser?: AuthenticatedUser | null;
};

export function CurrentUserProvider({
  children,
  initialUser,
}: CurrentUserProviderProps) {
  const hasInitialUser = initialUser !== undefined;
  const [isLoading, setIsLoading] = useState(!hasInitialUser);
  const [user, setUser] = useState<AuthenticatedUser | null>(initialUser ?? null);
  const [userError, setUserError] = useState(false);
  const [accountEpoch, setAccountEpoch] = useState(0);
  const currentUserIdRef = useRef(initialUser?.id ?? null);
  const accountEpochRef = useRef(0);
  const commitUser = useCallback((nextUser: AuthenticatedUser | null) => {
    const nextUserId = nextUser?.id ?? null;

    if (currentUserIdRef.current !== nextUserId) {
      currentUserIdRef.current = nextUserId;
      accountEpochRef.current += 1;
      setAccountEpoch(accountEpochRef.current);
    }

    setUser(nextUser);
  }, []);
  const isAccountEpochCurrent = useCallback(
    (accountEpoch: number) => accountEpochRef.current === accountEpoch,
    [],
  );

  useEffect(() => {
    if (hasInitialUser) {
      return;
    }

    let isCurrent = true;

    fetchCurrentUser()
      .then((nextUser) => {
        if (!isCurrent) {
          return;
        }

        commitUser(nextUser);
        setUserError(false);
      })
      .catch(() => {
        if (isCurrent) {
          setUserError(true);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [commitUser, hasInitialUser]);

  const logIn = useCallback(async (displayName: string, password: string) => {
    const nextUser = await logInUser(displayName, password);

    commitUser(nextUser);
    setUserError(false);
  }, [commitUser]);

  const signUp = useCallback(
    async (
      displayName: string,
      password: string,
      passwordConfirmation: string,
    ) => {
      const nextUser = await signUpUser(displayName, password, passwordConfirmation);

      commitUser(nextUser);
      setUserError(false);
    },
    [commitUser],
  );

  const signOut = useCallback(async () => {
    await signOutAfterPresenceRelease();
    commitUser(null);
    setUserError(false);
  }, [commitUser]);

  const value = useMemo(
    () => ({
      accountEpoch,
      isLoading,
      isAccountEpochCurrent,
      logIn,
      signOut,
      signUp,
      user,
      userError,
    }),
    [
      accountEpoch,
      isAccountEpochCurrent,
      isLoading,
      logIn,
      signOut,
      signUp,
      user,
      userError,
    ],
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}

/** Gives advisory lease cleanup a bounded head start before session deletion. */
export const SOCIAL_PRESENCE_SIGN_OUT_RELEASE_TIMEOUT_MS = 1_500;

type SignOutAfterPresenceReleaseOptions = {
  deleteSession?: () => Promise<void>;
  releasePresence?: () => Promise<void>;
  releaseTimeoutMs?: number;
  resumePresence?: () => void;
};

export async function signOutAfterPresenceRelease({
  deleteSession = signOutUser,
  releasePresence = releaseCurrentSocialPresenceLease,
  releaseTimeoutMs = SOCIAL_PRESENCE_SIGN_OUT_RELEASE_TIMEOUT_MS,
  resumePresence = resumeCurrentSocialPresenceLease,
}: SignOutAfterPresenceReleaseOptions = {}) {
  let releaseTimeout: ReturnType<typeof setTimeout> | null = null;

  let releaseAttempt: Promise<void>;
  try {
    releaseAttempt = releasePresence().catch(() => {});
  } catch {
    releaseAttempt = Promise.resolve();
  }

  await Promise.race([
    releaseAttempt,
    new Promise<void>((resolve) => {
      releaseTimeout = setTimeout(resolve, releaseTimeoutMs);
    }),
  ]);

  if (releaseTimeout !== null) {
    clearTimeout(releaseTimeout);
  }

  try {
    await deleteSession();
  } catch (error) {
    resumePresence();
    throw error;
  }
}
