"use client";

import { UserAccountAuthDialog } from "@/components/user-account-auth-dialog";
import { UserAccountProfileMenu } from "@/components/user-account-profile-menu";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { UserAuthMode } from "@/lib/user-profile";

type UserAccountControlsProps = {
  initialAuthMode?: UserAuthMode | null;
};

export function UserAccountControls({
  initialAuthMode = null,
}: UserAccountControlsProps) {
  const { isLoading, logIn, signOut, signUp, user, userError } = useCurrentUser();

  if (user) {
    return (
      <UserAccountProfileMenu signOut={signOut} user={user} userError={userError} />
    );
  }

  return (
    <UserAccountAuthDialog
      initialAuthMode={initialAuthMode}
      isLoading={isLoading}
      logIn={logIn}
      signUp={signUp}
      userError={userError}
    />
  );
}
