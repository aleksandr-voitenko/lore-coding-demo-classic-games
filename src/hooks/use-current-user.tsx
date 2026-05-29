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
  logInUser,
  signOutUser,
  signUpUser,
  type AuthenticatedUser,
} from "@/lib/user-profile";

type CurrentUserContextValue = {
  isLoading: boolean;
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
  isLoading: false,
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

  const logIn = useCallback(async (displayName: string, password: string) => {
    const nextUser = await logInUser(displayName, password);

    setUser(nextUser);
    setUserError(false);
  }, []);

  const signUp = useCallback(
    async (
      displayName: string,
      password: string,
      passwordConfirmation: string,
    ) => {
      const nextUser = await signUpUser(displayName, password, passwordConfirmation);

      setUser(nextUser);
      setUserError(false);
    },
    [],
  );

  const signOut = useCallback(async () => {
    await signOutUser();
    setUser(null);
    setUserError(false);
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      logIn,
      signOut,
      signUp,
      user,
      userError,
    }),
    [isLoading, logIn, signOut, signUp, user, userError],
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
