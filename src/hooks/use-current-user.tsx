"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  fetchCurrentUser,
  signInUser,
  signOutUser,
  type AuthenticatedUser,
} from "@/lib/user-profile";

type CurrentUserContextValue = {
  isLoading: boolean;
  signIn: (displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  user: AuthenticatedUser | null;
  userError: boolean;
};

const CurrentUserContext = createContext<CurrentUserContextValue>({
  isLoading: false,
  signIn: async () => {},
  signOut: async () => {},
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

        setUser(nextUser);
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
  }, [hasInitialUser]);

  const signIn = useCallback(async (displayName: string) => {
    const nextUser = await signInUser(displayName);

    setUser(nextUser);
    setUserError(false);
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
    setUser(null);
    setUserError(false);
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      signIn,
      signOut,
      user,
      userError,
    }),
    [isLoading, signIn, signOut, user, userError],
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
