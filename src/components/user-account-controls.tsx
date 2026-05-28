"use client";

import { LogInIcon, LogOutIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { MAX_USER_DISPLAY_NAME_LENGTH, normalizeUserDisplayName } from "@/lib/user-profile";

export function UserAccountControls() {
  const { isLoading, signIn, signOut, user, userError } = useCurrentUser();
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const normalizedDisplayName = normalizeUserDisplayName(displayName);

  async function handleSignIn() {
    if (normalizedDisplayName.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitFailed(false);

    try {
      await signIn(normalizedDisplayName);
      setDisplayName("");
    } catch {
      setSubmitFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitFailed(false);

    try {
      await signOut();
    } catch {
      setSubmitFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (user) {
    return (
      <div
        className="flex w-full flex-wrap items-center justify-start gap-2 rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] p-2 text-sm shadow-sm sm:w-auto sm:justify-end"
        data-testid="user-account-controls"
      >
        <Link
          className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2.5 font-medium text-[var(--snake-ink)] transition hover:bg-[color-mix(in_oklch,var(--snake-head)_12%,white)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)]"
          data-testid="profile-link"
          href="/profile"
        >
          <UserIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="max-w-36 truncate">{user.displayName}</span>
        </Link>
        <Button
          aria-label="Sign out"
          data-testid="sign-out-button"
          disabled={isSubmitting}
          onClick={handleSignOut}
          size="icon"
          type="button"
          variant="ghost"
        >
          <LogOutIcon />
        </Button>
        {submitFailed || userError ? (
          <p className="basis-full text-xs font-medium text-[var(--snake-muted)]" role="status">
            Account unavailable.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      autoComplete="off"
      className="grid w-full gap-2 rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] p-2 shadow-sm sm:w-auto sm:grid-cols-[minmax(9rem,13rem)_auto]"
      data-testid="user-account-controls"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSignIn();
      }}
    >
      <label className="sr-only" htmlFor="user-display-name">
        Display name
      </label>
      <input
        autoComplete="off"
        className="h-8 min-w-0 rounded-md border border-[var(--snake-border)] bg-white px-2.5 text-sm font-medium outline-none transition placeholder:text-[var(--snake-muted)] focus-visible:border-[var(--snake-head)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)]"
        data-testid="display-name-input"
        disabled={isLoading || isSubmitting}
        id="user-display-name"
        maxLength={MAX_USER_DISPLAY_NAME_LENGTH}
        onChange={(event) => setDisplayName(event.target.value)}
        placeholder="Display name"
        type="text"
        value={displayName}
      />
      <Button
        data-testid="sign-in-button"
        disabled={isLoading || isSubmitting || normalizedDisplayName.length === 0}
        size="lg"
        type="submit"
      >
        <LogInIcon data-icon="inline-start" />
        {isSubmitting ? "Signing in" : "Sign in"}
      </Button>
      {submitFailed || userError ? (
        <p
          className="text-xs font-medium text-[var(--snake-muted)] sm:col-span-2"
          data-testid="sign-in-error"
          role="status"
        >
          Account unavailable.
        </p>
      ) : null}
    </form>
  );
}
