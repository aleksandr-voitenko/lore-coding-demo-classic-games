"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import {
  RefreshCwIcon,
  SearchIcon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useSocial } from "@/components/social-provider";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import type {
  SocialAvailability,
  SocialPartyInvitation,
  SocialRelationship,
  SocialUserDiscovery,
} from "@/lib/social";
import {
  acceptSocialFriendRequest,
  acceptSocialPartyInvitation,
  blockSocialUser,
  cancelSocialFriendRequest,
  cancelSocialPartyInvitation,
  createSocialFriendRequest,
  declineSocialFriendRequest,
  declineSocialPartyInvitation,
  discoverSocialUser,
  removeSocialFriend,
  SocialClientError,
  unblockSocialUser,
  type SocialPartyInvitationAcceptance,
} from "@/lib/social-client";
import { MAX_USER_DISPLAY_NAME_LENGTH } from "@/lib/user-profile";

type SocialCenterProps = {
  canAcceptPartyInvitations?: boolean;
  onPartyInvitationAccepted?: (
    acceptance: SocialPartyInvitationAcceptance,
  ) => Promise<void> | void;
};

type PendingConfirmation = {
  action: () => Promise<boolean>;
  description: string;
  key: string;
  label: string;
};

type PendingPartyHandoff =
  | {
      acceptance: SocialPartyInvitationAcceptance;
      kind: "adoption";
    }
  | {
      invitation: SocialPartyInvitation;
      kind: "acceptance";
    };

type PartyInvitationAction = "accept" | "decline";

type SocialActionResult<Result> =
  | { ok: true; value: Result }
  | { ok: false };

let socialCenterReturnFocusTarget: HTMLButtonElement | null = null;

export function getSocialAvailabilityLabel(
  availability: SocialAvailability,
) {
  switch (availability) {
    case "available":
      return "Available";
    case "busy":
      return "Busy";
    case "in-party":
      return "In a party";
    case "offline":
      return "Offline";
    case "unknown":
      return "Checking availability";
  }
}

export function getPartyInvitationAcceptanceMessage(
  availability: SocialAvailability,
  canAdoptParty: boolean,
) {
  switch (availability) {
    case "busy":
      return "Finish the current game before accepting this invitation.";
    case "in-party":
      return "Leave your current party before accepting another invitation.";
    case "offline":
      return "Reconnect before accepting this invitation.";
    case "unknown":
      return "Wait for your availability to finish updating before accepting.";
    case "available":
      return canAdoptParty
        ? null
        : "Return to the Game Library or Leaderboards to accept this invitation.";
  }
}

export function getPartyInvitationIntentDescription(
  invitation: SocialPartyInvitation,
) {
  return invitation.intent === "watch"
    ? "Watch invitation. Accepting joins as Watching; capacity is checked when you accept."
    : "Play invitation. Accepting offers a player spot when available, otherwise Watching; capacity is checked when you accept.";
}

export function formatSocialActionError(error: unknown) {
  if (error instanceof SocialClientError && error.retryAfterSeconds !== null) {
    return `${error.message} Try again in ${error.retryAfterSeconds} seconds.`;
  }

  return error instanceof Error ? error.message : "Friends are unavailable.";
}

export function isAmbiguousPartyAcceptanceError(error: unknown) {
  return (
    error instanceof SocialClientError &&
    (error.code === "network-error" || error.code === "invalid-response")
  );
}

export function isRetryablePartyAcceptanceRecoveryError(error: unknown) {
  return (
    error instanceof SocialClientError &&
    (error.code === "party-invitation-acceptance-in-progress" ||
      error.status === 429 ||
      error.status >= 500)
  );
}

function isResolvedPartyInvitationError(error: unknown) {
  return (
    error instanceof SocialClientError &&
    (error.code === "party-invitation-expired" ||
      error.code === "party-invitation-not-found" ||
      error.code === "party-invitation-not-pending")
  );
}

function setButtonRef(
  refs: Map<string, HTMLButtonElement>,
  invitationId: string,
  button: HTMLButtonElement | null,
) {
  if (button === null) {
    refs.delete(invitationId);
  } else {
    refs.set(invitationId, button);
  }
}

export function SocialCenterTrigger() {
  const { isEnabled, openSocialCenter, pendingCount } = useSocial();

  if (!isEnabled) {
    return null;
  }

  const pendingLabel =
    pendingCount === 0
      ? ""
      : `, ${pendingCount} pending ${pendingCount === 1 ? "item" : "items"}`;

  return (
    <button
      aria-haspopup="dialog"
      aria-label={`Friends${pendingLabel}`}
      className="relative inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] px-3 text-sm font-semibold text-[var(--chrome-ink)] shadow-sm transition hover:bg-[var(--chrome-accent-faint)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)] active:translate-y-px"
      data-testid="social-center-trigger"
      onClick={(event) => {
        socialCenterReturnFocusTarget = event.currentTarget;
        openSocialCenter();
      }}
      type="button"
    >
      <UsersIcon className="size-4" aria-hidden="true" />
      Friends
      {pendingCount > 0 ? (
        <span
          aria-hidden="true"
          className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--chrome-accent)] px-1.5 py-0.5 text-xs font-bold text-[var(--chrome-accent-ink)]"
          data-testid="social-center-pending-count"
        >
          {pendingCount > 99 ? "99+" : pendingCount}
        </span>
      ) : null}
    </button>
  );
}

export function SocialCenter({
  canAcceptPartyInvitations = false,
  onPartyInvitationAccepted,
}: SocialCenterProps = {}) {
  const { accountEpoch, user } = useCurrentUser();
  const { isEnabled } = useSocial();

  if (!isEnabled || user === null) {
    return null;
  }

  return (
    <SocialCenterAccountScope
      canAcceptPartyInvitations={canAcceptPartyInvitations}
      key={`${accountEpoch}:${user.id}`}
      onPartyInvitationAccepted={onPartyInvitationAccepted}
    />
  );
}

function SocialCenterAccountScope({
  canAcceptPartyInvitations,
  onPartyInvitationAccepted,
}: SocialCenterProps) {
  const {
    availability,
    isLoading,
    isMutationPending,
    isRefreshing,
    isSocialCenterOpen,
    overview,
    overviewError,
    presenceError,
    refresh,
    runMutation,
    setSocialCenterOpen,
  } = useSocial();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<PendingConfirmation | null>(null);
  const [activePartyInvitationActions, setActivePartyInvitationActions] =
    useState<Record<string, PartyInvitationAction>>({});
  const [isPartyAdoptionPending, setIsPartyAdoptionPending] = useState(false);
  const [pendingPartyHandoff, setPendingPartyHandoff] =
    useState<PendingPartyHandoff | null>(null);
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] =
    useState<SocialUserDiscovery | null>(null);
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmationReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const partyHandoffRetryRef = useRef<HTMLButtonElement | null>(null);
  const partyInvitationAcceptRefs = useRef(
    new Map<string, HTMLButtonElement>(),
  );
  const partyInvitationDeclineRefs = useRef(
    new Map<string, HTMLButtonElement>(),
  );
  const partyInvitationAcceptanceInFlightRef = useRef<string | null>(null);
  const focusedPartyInvitationActionRef = useRef<{
    button: HTMLButtonElement;
    invitationId: string;
  } | null>(null);
  const partyInvitationsTitleRef = useRef<HTMLHeadingElement | null>(null);
  const pendingPartyInvitationFocusRef = useRef<{
    invitationId: string;
    nextInvitationId: string | null;
  } | null>(null);
  const [partyFocusRequestVersion, setPartyFocusRequestVersion] = useState(0);
  const wasOpenRef = useRef(false);
  const acceptanceMessage = getPartyInvitationAcceptanceMessage(
    availability,
    canAcceptPartyInvitations === true &&
      onPartyInvitationAccepted !== undefined,
  );

  const focusPartyInvitationFallback = useCallback(
    (invitationId: string | null) => {
      const acceptButton =
        acceptanceMessage === null && invitationId !== null
          ? partyInvitationAcceptRefs.current.get(invitationId)
          : undefined;
      const declineButton =
        invitationId === null
          ? undefined
          : partyInvitationDeclineRefs.current.get(invitationId);

      if (acceptButton !== undefined && !acceptButton.disabled) {
        acceptButton.focus();
      } else if (declineButton !== undefined && !declineButton.disabled) {
        declineButton.focus();
      } else {
        partyInvitationsTitleRef.current?.focus();
      }
    },
    [acceptanceMessage],
  );

  const resetLocalState = useCallback(() => {
    setActionError(null);
    setConfirmation(null);
    confirmationReturnFocusRef.current = null;
    setQuery("");
    setSearchError(null);
    setSearchResult(null);
    setSearchSubmitted(false);
    setStatusMessage(null);
  }, []);

  const clearConfirmation = useCallback(() => {
    const returnFocusTarget = confirmationReturnFocusRef.current;
    confirmationReturnFocusRef.current = null;
    setConfirmation(null);
    queueMicrotask(() => {
      if (returnFocusTarget?.isConnected) {
        returnFocusTarget.focus();
      }
    });
  }, []);

  useEffect(() => {
    if (wasOpenRef.current && !isSocialCenterOpen) {
      const returnFocusTarget = socialCenterReturnFocusTarget;
      socialCenterReturnFocusTarget = null;
      queueMicrotask(() => {
        if (returnFocusTarget?.isConnected) {
          returnFocusTarget.focus();
        }
      });
    }

    wasOpenRef.current = isSocialCenterOpen;
  }, [isSocialCenterOpen]);

  useEffect(() => {
    if (confirmation === null) {
      return;
    }

    queueMicrotask(() => confirmationCancelRef.current?.focus());
  }, [confirmation]);

  useEffect(() => {
    if (!isSocialCenterOpen || pendingPartyHandoff === null) {
      return;
    }

    queueMicrotask(() => partyHandoffRetryRef.current?.focus());
  }, [isSocialCenterOpen, pendingPartyHandoff]);

  useEffect(() => {
    const focusRequest = pendingPartyInvitationFocusRef.current;
    const incomingInvitations = overview?.incomingPartyInvitations ?? [];

    if (
      focusRequest === null ||
      incomingInvitations.some(
        (invitation) => invitation.id === focusRequest.invitationId,
      )
    ) {
      return;
    }

    pendingPartyInvitationFocusRef.current = null;
    queueMicrotask(() =>
      focusPartyInvitationFallback(focusRequest.nextInvitationId),
    );
  }, [focusPartyInvitationFallback, overview?.incomingPartyInvitations, partyFocusRequestVersion]);

  useEffect(() => {
    const focusedAction = focusedPartyInvitationActionRef.current;

    if (focusedAction === null || focusedAction.button.isConnected) {
      return;
    }

    focusedPartyInvitationActionRef.current = null;
    const handoffInvitationId =
      pendingPartyHandoff?.kind === "adoption"
        ? pendingPartyHandoff.acceptance.invitation.id
        : pendingPartyHandoff?.invitation.id;

    if (
      pendingPartyInvitationFocusRef.current?.invitationId ===
        focusedAction.invitationId ||
      handoffInvitationId === focusedAction.invitationId ||
      !document.hasFocus()
    ) {
      return;
    }

    const nextInvitationId =
      overview?.incomingPartyInvitations[0]?.id ?? null;
    queueMicrotask(() => focusPartyInvitationFallback(nextInvitationId));
  }, [focusPartyInvitationFallback, overview?.incomingPartyInvitations, pendingPartyHandoff]);

  async function runAction<Result>(
    key: string,
    action: () => Promise<Result>,
    successMessage: string,
  ): Promise<SocialActionResult<Result>> {
    setActionError(null);
    setStatusMessage(null);

    try {
      const value = await runMutation(key, action);
      setSearchResult(null);
      setSearchSubmitted(false);
      setStatusMessage(successMessage);
      return { ok: true, value };
    } catch (error) {
      setActionError(formatSocialActionError(error));
      return { ok: false };
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = query.trim();

    setActionError(null);
    setSearchError(null);
    setSearchResult(null);
    setSearchSubmitted(false);
    setStatusMessage(null);

    if (displayName.length === 0) {
      setSearchError("Enter an exact user name.");
      return;
    }

    if (displayName.length > MAX_USER_DISPLAY_NAME_LENGTH) {
      setSearchError("Enter a supported user name.");
      return;
    }

    try {
      const result = await runMutation("social-discovery", () =>
        discoverSocialUser(displayName),
      );
      setSearchResult(result);
      setSearchSubmitted(true);
    } catch (error) {
      setSearchError(formatSocialActionError(error));
    }
  }

  function requestConfirmation(
    key: string,
    label: string,
    description: string,
    action: () => Promise<boolean>,
  ) {
    setActionError(null);
    confirmationReturnFocusRef.current =
      document.activeElement instanceof HTMLButtonElement
        ? document.activeElement
        : null;
    setConfirmation({ action, description, key, label });
  }

  function setActivePartyInvitationAction(
    invitationId: string,
    action: PartyInvitationAction | null,
  ) {
    setActivePartyInvitationActions((current) => {
      const next = { ...current };

      if (action === null) {
        delete next[invitationId];
      } else {
        next[invitationId] = action;
      }

      return next;
    });
  }

  function requestPartyInvitationRemovalFocus(invitationId: string) {
    const invitations = overview?.incomingPartyInvitations ?? [];
    const invitationIndex = invitations.findIndex(
      (invitation) => invitation.id === invitationId,
    );
    const nextInvitation =
      invitations[invitationIndex + 1] ??
      invitations[invitationIndex - 1] ??
      null;

    pendingPartyInvitationFocusRef.current = {
      invitationId,
      nextInvitationId: nextInvitation?.id ?? null,
    };
    setPartyFocusRequestVersion((current) => current + 1);
  }

  async function adoptAcceptedParty(
    acceptance: SocialPartyInvitationAcceptance,
  ) {
    if (onPartyInvitationAccepted === undefined) {
      return;
    }

    setActionError(null);
    setIsPartyAdoptionPending(true);

    try {
      await onPartyInvitationAccepted(acceptance);
      setPendingPartyHandoff(null);
      handleOpenChange(false);
    } catch (error) {
      setActionError(
        `The party was accepted but could not be opened. ${formatSocialActionError(error)}`,
      );
    } finally {
      setIsPartyAdoptionPending(false);
    }
  }

  async function handleAcceptPartyInvitation(
    invitation: SocialPartyInvitation,
  ) {
    if (
      onPartyInvitationAccepted === undefined ||
      partyInvitationAcceptanceInFlightRef.current !== null ||
      (pendingPartyHandoff !== null &&
        (pendingPartyHandoff.kind === "adoption"
          ? pendingPartyHandoff.acceptance.invitation.id
          : pendingPartyHandoff.invitation.id) !== invitation.id)
    ) {
      return;
    }

    partyInvitationAcceptanceInFlightRef.current = invitation.id;
    setActionError(null);
    setStatusMessage(null);
    setActivePartyInvitationAction(invitation.id, "accept");
    const isAcceptanceRecovery =
      pendingPartyHandoff?.kind === "acceptance" &&
      pendingPartyHandoff.invitation.id === invitation.id;

    try {
      const acceptance = await runMutation(
        `party-invitation:${invitation.id}`,
        () => acceptSocialPartyInvitation(invitation.id),
      );
      setSearchResult(null);
      setSearchSubmitted(false);
      setStatusMessage(
        `${invitation.intent === "play" ? "Play" : "Watch"} invitation from ${invitation.inviter.displayName} accepted.`,
      );
      setPendingPartyHandoff({ acceptance, kind: "adoption" });
      await adoptAcceptedParty(acceptance);
    } catch (error) {
      if (isAmbiguousPartyAcceptanceError(error)) {
        setPendingPartyHandoff({ invitation, kind: "acceptance" });
        setActionError(
          `The ${invitation.intent === "play" ? "Play" : "Watch"} invitation response from ${invitation.inviter.displayName} was interrupted. Confirm acceptance to recover it safely.`,
        );
        return;
      }

      if (isResolvedPartyInvitationError(error)) {
        setPendingPartyHandoff(null);
        setStatusMessage(
          `${invitation.intent === "play" ? "Play" : "Watch"} invitation from ${invitation.inviter.displayName} is no longer available.`,
        );
        requestPartyInvitationRemovalFocus(invitation.id);
        return;
      }

      if (isRetryablePartyAcceptanceRecoveryError(error)) {
        setPendingPartyHandoff({ invitation, kind: "acceptance" });
        setActionError(
          isAcceptanceRecovery
            ? `Party access for the ${invitation.intent === "play" ? "Play" : "Watch"} invitation from ${invitation.inviter.displayName} could not be recovered yet. ${formatSocialActionError(error)}`
            : `Party acceptance for the ${invitation.intent === "play" ? "Play" : "Watch"} invitation from ${invitation.inviter.displayName} could not be confirmed yet. ${formatSocialActionError(error)}`,
        );
        return;
      }

      setPendingPartyHandoff(null);
      setActionError(
        `Could not accept the ${invitation.intent === "play" ? "Play" : "Watch"} invitation from ${invitation.inviter.displayName}. ${formatSocialActionError(error)}`,
      );
    } finally {
      if (partyInvitationAcceptanceInFlightRef.current === invitation.id) {
        partyInvitationAcceptanceInFlightRef.current = null;
      }
      setActivePartyInvitationAction(invitation.id, null);
    }
  }

  async function handleDeclinePartyInvitation(
    invitation: SocialPartyInvitation,
  ) {
    const key = `party-invitation:${invitation.id}`;
    const intentLabel = invitation.intent === "play" ? "Play" : "Watch";
    let invitationRemoved = false;

    setActionError(null);
    setStatusMessage(null);
    setActivePartyInvitationAction(invitation.id, "decline");

    try {
      await runMutation(key, () =>
        declineSocialPartyInvitation(invitation.id),
      );
      invitationRemoved = true;
      setSearchResult(null);
      setSearchSubmitted(false);
      setStatusMessage(
        `${intentLabel} invitation from ${invitation.inviter.displayName} declined.`,
      );
    } catch (error) {
      if (isResolvedPartyInvitationError(error)) {
        invitationRemoved = true;
        setStatusMessage(
          `${intentLabel} invitation from ${invitation.inviter.displayName} is no longer available.`,
        );
      } else {
        setActionError(
          `Could not decline the ${intentLabel} invitation from ${invitation.inviter.displayName}. ${formatSocialActionError(error)}`,
        );
      }
    } finally {
      setActivePartyInvitationAction(invitation.id, null);

      if (invitationRemoved) {
        requestPartyInvitationRemovalFocus(invitation.id);
      }
    }
  }

  function handleOpenChange(open: boolean) {
    setSocialCenterOpen(open);

    if (!open) {
      resetLocalState();
    }
  }

  const discoveryPending = isMutationPending("social-discovery");
  const anyPartyAcceptancePending =
    pendingPartyHandoff !== null ||
    Object.values(activePartyInvitationActions).includes("accept");

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open={isSocialCenterOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-[70] flex max-h-[min(48rem,calc(100svh-2rem))] w-[min(calc(100vw-2rem),44rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] text-[var(--chrome-ink)] shadow-[0_24px_90px_var(--chrome-shadow-modal)] outline-none"
          data-testid="social-center-dialog"
        >
          <header className="relative border-b border-[var(--chrome-border)] px-5 py-4 pr-14">
            <Dialog.Title className="text-2xl font-semibold tracking-normal">
              Friends
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm font-medium text-[var(--chrome-muted)]">
              Find people you know, manage friendships, and respond to party
              invitations without sharing a link.
            </Dialog.Description>
            <Dialog.Close
              aria-label="Close Friends"
              className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] transition hover:bg-[var(--chrome-accent-faint)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)]"
              data-testid="social-center-close-button"
              type="button"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
            <section
              aria-labelledby="social-center-search-title"
              className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-page)] p-4"
            >
              <h2
                className="text-lg font-semibold"
                id="social-center-search-title"
              >
                Find a friend
              </h2>
              <p className="mt-1 text-sm text-[var(--chrome-muted)]">
                Enter their complete user name. Search does not suggest public
                accounts.
              </p>
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
                data-testid="social-discovery-form"
                onSubmit={handleSearch}
              >
                <Field.Root className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Field.Label
                    className="text-sm font-semibold"
                    htmlFor="social-discovery-name"
                  >
                    Exact user name
                  </Field.Label>
                  <Input
                    aria-describedby={
                      searchError === null
                        ? "social-discovery-help"
                        : "social-discovery-error"
                    }
                    autoComplete="off"
                    className="h-11 min-w-0 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] px-3 text-sm font-medium outline-none transition placeholder:text-[var(--chrome-muted)] focus-visible:border-[var(--chrome-accent)] focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)]"
                    data-testid="social-discovery-input"
                    disabled={discoveryPending}
                    id="social-discovery-name"
                    maxLength={MAX_USER_DISPLAY_NAME_LENGTH}
                    onValueChange={(value) => {
                      setQuery(value);
                      setSearchError(null);
                      setSearchResult(null);
                      setSearchSubmitted(false);
                    }}
                    placeholder="Player name"
                    value={query}
                  />
                </Field.Root>
                <Button
                  className="min-h-11"
                  data-testid="social-discovery-submit"
                  disabled={discoveryPending}
                  size="lg"
                  type="submit"
                >
                  <SearchIcon data-icon="inline-start" />
                  {discoveryPending ? "Searching..." : "Search"}
                </Button>
              </form>
              <p
                className="mt-2 text-xs font-medium text-[var(--chrome-muted)]"
                id="social-discovery-help"
              >
                Only one exact match can be returned.
              </p>
              {searchError !== null ? (
                <p
                  className="mt-2 text-sm font-medium text-destructive"
                  id="social-discovery-error"
                  role="alert"
                >
                  {searchError}
                </p>
              ) : null}
              {searchResult !== null ? (
                <SocialRow
                  subtitle={getRelationshipLabel(searchResult.relationship)}
                  testId="social-discovery-result"
                  title={searchResult.user.displayName}
                >
                  <RelationshipActions
                    isMutationPending={isMutationPending}
                    onAccept={() =>
                      runAction(
                        `relationship:${searchResult.user.id}`,
                        () => acceptSocialFriendRequest(searchResult.user.id),
                        `You and ${searchResult.user.displayName} are now friends.`,
                      ).then((result) => result.ok)
                    }
                    onBlock={() =>
                      requestConfirmation(
                        `relationship:${searchResult.user.id}`,
                        "Block player",
                        `Block ${searchResult.user.displayName}? Existing requests, friendship, and invitations between you will be removed.`,
                        () =>
                          runAction(
                            `relationship:${searchResult.user.id}`,
                            () => blockSocialUser(searchResult.user.id),
                            `${searchResult.user.displayName} was blocked.`,
                          ).then((result) => result.ok),
                      )
                    }
                    onCancel={() =>
                      runAction(
                        `relationship:${searchResult.user.id}`,
                        () => cancelSocialFriendRequest(searchResult.user.id),
                        "Friend request canceled.",
                      ).then((result) => result.ok)
                    }
                    onDecline={() =>
                      runAction(
                        `relationship:${searchResult.user.id}`,
                        () => declineSocialFriendRequest(searchResult.user.id),
                        "Friend request declined.",
                      ).then((result) => result.ok)
                    }
                    onRemove={() =>
                      requestConfirmation(
                        `relationship:${searchResult.user.id}`,
                        "Remove friend",
                        `Remove ${searchResult.user.displayName} from your friends? Pending party invitations between you will also be removed.`,
                        () =>
                          runAction(
                            `relationship:${searchResult.user.id}`,
                            () => removeSocialFriend(searchResult.user.id),
                            `${searchResult.user.displayName} was removed from your friends.`,
                          ).then((result) => result.ok),
                      )
                    }
                    onRequest={() =>
                      runAction(
                        `relationship:${searchResult.user.id}`,
                        () => createSocialFriendRequest(searchResult.user.id),
                        `Friend request sent to ${searchResult.user.displayName}.`,
                      ).then((result) => result.ok)
                    }
                    relationship={searchResult.relationship}
                    userId={searchResult.user.id}
                  />
                </SocialRow>
              ) : searchSubmitted ? (
                <p className="mt-3 text-sm font-medium" role="status">
                  No exact match found.
                </p>
              ) : null}
            </section>

            {overviewError !== null ? (
              <div
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3"
                role="alert"
              >
                <p className="text-sm font-medium">
                  {formatSocialActionError(overviewError)}
                </p>
                <Button
                  className="mt-2 min-h-11"
                  disabled={isRefreshing}
                  onClick={() => void refresh()}
                  type="button"
                  variant="outline"
                >
                  <RefreshCwIcon data-icon="inline-start" />
                  Retry
                </Button>
              </div>
            ) : null}

            {presenceError !== null ? (
              <p
                className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-page)] p-3 text-sm font-medium text-[var(--chrome-muted)]"
                role="status"
              >
                Availability is temporarily unknown. Party invitations stay
                disabled until it recovers.
              </p>
            ) : null}

            {actionError !== null ? (
              <p
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive"
                data-testid="social-center-action-error"
                role="alert"
              >
                {actionError}
              </p>
            ) : null}
            {pendingPartyHandoff !== null ? (
              <div
                className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-accent-faint)] p-3"
                data-testid="social-party-handoff-retry"
                role="status"
              >
                <p className="text-sm font-medium">
                  {pendingPartyHandoff.kind === "adoption"
                    ? `Party accepted from ${pendingPartyHandoff.acceptance.invitation.inviter.displayName}. Open it to continue.`
                    : `Confirm the invitation from ${pendingPartyHandoff.invitation.inviter.displayName} to recover the party.`}
                </p>
                <Button
                  aria-label={
                    pendingPartyHandoff.kind === "adoption"
                      ? `Open accepted ${pendingPartyHandoff.acceptance.invitation.intent} invitation from ${pendingPartyHandoff.acceptance.invitation.inviter.displayName}`
                      : `Confirm ${pendingPartyHandoff.invitation.intent} invitation acceptance from ${pendingPartyHandoff.invitation.inviter.displayName}`
                  }
                  className="mt-3 min-h-11"
                  disabled={
                    pendingPartyHandoff.kind === "adoption"
                      ? isPartyAdoptionPending
                      : isMutationPending(
                          `party-invitation:${pendingPartyHandoff.invitation.id}`,
                        )
                  }
                  onClick={() => {
                    if (pendingPartyHandoff.kind === "adoption") {
                      void adoptAcceptedParty(pendingPartyHandoff.acceptance);
                    } else {
                      void handleAcceptPartyInvitation(
                        pendingPartyHandoff.invitation,
                      );
                    }
                  }}
                  ref={partyHandoffRetryRef}
                  type="button"
                >
                  {pendingPartyHandoff.kind === "adoption"
                    ? isPartyAdoptionPending
                      ? "Opening party..."
                      : "Open accepted party"
                    : isMutationPending(
                          `party-invitation:${pendingPartyHandoff.invitation.id}`,
                        )
                      ? "Confirming..."
                      : "Confirm party acceptance"}
                </Button>
              </div>
            ) : null}
            {statusMessage !== null ? (
              <p
                className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-accent-faint)] p-3 text-sm font-medium"
                data-testid="social-center-status"
                role="status"
              >
                {statusMessage}
              </p>
            ) : null}

            {confirmation !== null ? (
              <div
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3"
                data-testid="social-center-confirmation"
                role="alert"
              >
                <p className="text-sm font-medium">{confirmation.description}</p>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button
                    className="min-h-11"
                    disabled={isMutationPending(confirmation.key)}
                    onClick={clearConfirmation}
                    ref={confirmationCancelRef}
                    type="button"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="min-h-11"
                    disabled={isMutationPending(confirmation.key)}
                    onClick={() => {
                      void confirmation.action().then((succeeded) => {
                        if (succeeded) {
                          clearConfirmation();
                        }
                      });
                    }}
                    type="button"
                    variant="destructive"
                  >
                    {confirmation.label}
                  </Button>
                </div>
              </div>
            ) : null}

            {isLoading && overview === null ? (
              <p className="py-8 text-center text-sm font-medium text-[var(--chrome-muted)]">
                Loading friends...
              </p>
            ) : overview !== null ? (
              <>
                <SocialSection
                  emptyMessage="No party invitations."
                  id="social-party-invitations"
                  itemCount={overview.incomingPartyInvitations.length}
                  title="Party invitations"
                  titleRef={partyInvitationsTitleRef}
                  titleTabIndex={-1}
                >
                  {overview.incomingPartyInvitations.map((invitation) => {
                    const key = `party-invitation:${invitation.id}`;
                    const pending = isMutationPending(key);
                    const activeAction =
                      activePartyInvitationActions[invitation.id];
                    const recoveryKind =
                      pendingPartyHandoff?.kind === "adoption" &&
                      pendingPartyHandoff.acceptance.invitation.id ===
                        invitation.id
                        ? "adoption"
                        : pendingPartyHandoff?.kind === "acceptance" &&
                            pendingPartyHandoff.invitation.id === invitation.id
                          ? "acceptance"
                          : null;
                    const actionPending =
                      pending ||
                      activeAction !== undefined ||
                      recoveryKind !== null;
                    const intentLabel =
                      invitation.intent === "play" ? "Play" : "Watch";
                    const statusId = `social-party-invitation-${invitation.id}-status`;
                    const rowStatus =
                      activeAction === "accept"
                        ? `Accepting ${intentLabel} invitation from ${invitation.inviter.displayName}...`
                        : activeAction === "decline"
                          ? `Declining ${intentLabel} invitation from ${invitation.inviter.displayName}...`
                          : recoveryKind === "adoption"
                            ? `This ${intentLabel} invitation is already accepted. Use Open accepted party above to continue.`
                            : recoveryKind === "acceptance"
                              ? `This ${intentLabel} invitation needs confirmation. Use Confirm party acceptance above to continue.`
                              : pendingPartyHandoff !== null
                                ? `Finish recovering or opening the accepted party before accepting this ${intentLabel} invitation.`
                                : [
                                    getPartyInvitationIntentDescription(
                                      invitation,
                                    ),
                                    acceptanceMessage,
                                  ]
                                    .filter(
                                      (message): message is string =>
                                        message !== null,
                                    )
                                    .join(" ");

                    return (
                      <SocialRow
                        key={invitation.id}
                        subtitle={rowStatus}
                        subtitleAriaLive="polite"
                        subtitleId={statusId}
                        testId={`incoming-party-invitation-${invitation.id}`}
                        title={invitation.inviter.displayName}
                      >
                        <Button
                          aria-describedby={statusId}
                          aria-label={
                            activeAction === "accept"
                              ? `Accepting ${intentLabel} invitation from ${invitation.inviter.displayName}`
                              : `Accept ${intentLabel} invitation from ${invitation.inviter.displayName}`
                          }
                          className="min-h-11"
                          disabled={
                            actionPending ||
                            anyPartyAcceptancePending ||
                            acceptanceMessage !== null
                          }
                          onClick={() =>
                            void handleAcceptPartyInvitation(invitation)
                          }
                          onBlur={(event) => {
                            const button = event.currentTarget;

                            queueMicrotask(() => {
                              if (
                                button.isConnected &&
                                focusedPartyInvitationActionRef.current
                                  ?.button === button
                              ) {
                                focusedPartyInvitationActionRef.current = null;
                              }
                            });
                          }}
                          onFocus={(event) => {
                            focusedPartyInvitationActionRef.current = {
                              button: event.currentTarget,
                              invitationId: invitation.id,
                            };
                          }}
                          ref={(button) =>
                            setButtonRef(
                              partyInvitationAcceptRefs.current,
                              invitation.id,
                              button,
                            )
                          }
                          type="button"
                        >
                          {activeAction === "accept" ? "Accepting..." : "Accept"}
                        </Button>
                        <Button
                          aria-describedby={statusId}
                          aria-label={
                            activeAction === "decline"
                              ? `Declining ${intentLabel} invitation from ${invitation.inviter.displayName}`
                              : `Decline ${intentLabel} invitation from ${invitation.inviter.displayName}`
                          }
                          className="min-h-11"
                          disabled={actionPending}
                          onClick={() =>
                            void handleDeclinePartyInvitation(invitation)
                          }
                          onBlur={(event) => {
                            const button = event.currentTarget;

                            queueMicrotask(() => {
                              if (
                                button.isConnected &&
                                focusedPartyInvitationActionRef.current
                                  ?.button === button
                              ) {
                                focusedPartyInvitationActionRef.current = null;
                              }
                            });
                          }}
                          onFocus={(event) => {
                            focusedPartyInvitationActionRef.current = {
                              button: event.currentTarget,
                              invitationId: invitation.id,
                            };
                          }}
                          ref={(button) =>
                            setButtonRef(
                              partyInvitationDeclineRefs.current,
                              invitation.id,
                              button,
                            )
                          }
                          type="button"
                          variant="outline"
                        >
                          {activeAction === "decline"
                            ? "Declining..."
                            : "Decline"}
                        </Button>
                      </SocialRow>
                    );
                  })}
                </SocialSection>

                <SocialSection
                  emptyMessage="No incoming friend requests."
                  id="social-incoming-requests"
                  itemCount={overview.incomingFriendRequests.length}
                  title="Friend requests"
                >
                  {overview.incomingFriendRequests.map((request) => {
                    const key = `relationship:${request.user.id}`;
                    const pending = isMutationPending(key);

                    return (
                      <SocialRow
                        key={request.user.id}
                        subtitle="Wants to be friends"
                        title={request.user.displayName}
                      >
                        <Button
                          className="min-h-11"
                          disabled={pending}
                          onClick={() =>
                            void runAction(
                              key,
                              () => acceptSocialFriendRequest(request.user.id),
                              `You and ${request.user.displayName} are now friends.`,
                            )
                          }
                          type="button"
                        >
                          Accept
                        </Button>
                        <Button
                          className="min-h-11"
                          disabled={pending}
                          onClick={() =>
                            void runAction(
                              key,
                              () => declineSocialFriendRequest(request.user.id),
                              "Friend request declined.",
                            )
                          }
                          type="button"
                          variant="outline"
                        >
                          Decline
                        </Button>
                      </SocialRow>
                    );
                  })}
                </SocialSection>

                <SocialSection
                  emptyMessage="Add a friend by their exact user name."
                  id="social-friends"
                  itemCount={overview.friends.length}
                  title="Friends"
                >
                  {overview.friends.map((friend) => {
                    const key = `relationship:${friend.user.id}`;
                    const pending = isMutationPending(key);

                    return (
                      <SocialRow
                        key={friend.user.id}
                        subtitle={getSocialAvailabilityLabel(
                          friend.availability,
                        )}
                        testId={`social-friend-${friend.user.id}`}
                        title={friend.user.displayName}
                      >
                        <Button
                          className="min-h-11"
                          disabled={pending}
                          onClick={() =>
                            requestConfirmation(
                              key,
                              "Remove friend",
                              `Remove ${friend.user.displayName} from your friends? Pending party invitations between you will also be removed.`,
                              () =>
                                runAction(
                                  key,
                                  () => removeSocialFriend(friend.user.id),
                                  `${friend.user.displayName} was removed from your friends.`,
                                ).then((result) => result.ok),
                            )
                          }
                          type="button"
                          variant="outline"
                        >
                          Remove
                        </Button>
                        <Button
                          className="min-h-11"
                          disabled={pending}
                          onClick={() =>
                            requestConfirmation(
                              key,
                              "Block player",
                              `Block ${friend.user.displayName}? Existing requests, friendship, and invitations between you will be removed.`,
                              () =>
                                runAction(
                                  key,
                                  () => blockSocialUser(friend.user.id),
                                  `${friend.user.displayName} was blocked.`,
                                ).then((result) => result.ok),
                            )
                          }
                          type="button"
                          variant="destructive"
                        >
                          Block
                        </Button>
                      </SocialRow>
                    );
                  })}
                </SocialSection>

                <SocialSection
                  emptyMessage="No sent friend requests."
                  id="social-outgoing-requests"
                  itemCount={overview.outgoingFriendRequests.length}
                  title="Sent requests"
                >
                  {overview.outgoingFriendRequests.map((request) => {
                    const key = `relationship:${request.user.id}`;

                    return (
                      <SocialRow
                        key={request.user.id}
                        subtitle="Waiting for a response"
                        title={request.user.displayName}
                      >
                        <Button
                          className="min-h-11"
                          disabled={isMutationPending(key)}
                          onClick={() =>
                            void runAction(
                              key,
                              () => cancelSocialFriendRequest(request.user.id),
                              "Friend request canceled.",
                            )
                          }
                          type="button"
                          variant="outline"
                        >
                          Cancel request
                        </Button>
                      </SocialRow>
                    );
                  })}
                </SocialSection>

                <SocialSection
                  emptyMessage="No sent party invitations."
                  id="social-outgoing-invitations"
                  itemCount={overview.outgoingPartyInvitations.length}
                  title="Sent party invitations"
                >
                  {overview.outgoingPartyInvitations.map((invitation) => {
                    const key = `party-invitation:${invitation.id}`;

                    return (
                      <SocialRow
                        key={invitation.id}
                        subtitle={`${invitation.intent === "play" ? "Play" : "Watch"} invitation pending`}
                        title={invitation.recipient.displayName}
                      >
                        <Button
                          className="min-h-11"
                          disabled={isMutationPending(key)}
                          onClick={() =>
                            void runAction(
                              key,
                              () => cancelSocialPartyInvitation(invitation.id),
                              "Party invitation canceled.",
                            )
                          }
                          type="button"
                          variant="outline"
                        >
                          Cancel invitation
                        </Button>
                      </SocialRow>
                    );
                  })}
                </SocialSection>

                <SocialSection
                  emptyMessage="No blocked players."
                  id="social-blocked-users"
                  itemCount={overview.blockedUsers.length}
                  title="Blocked"
                >
                  {overview.blockedUsers.map((block) => {
                    const key = `relationship:${block.user.id}`;

                    return (
                      <SocialRow
                        key={block.user.id}
                        subtitle="Cannot find or contact you"
                        title={block.user.displayName}
                      >
                        <Button
                          className="min-h-11"
                          disabled={isMutationPending(key)}
                          onClick={() =>
                            void runAction(
                              key,
                              () => unblockSocialUser(block.user.id),
                              `${block.user.displayName} was unblocked.`,
                            )
                          }
                          type="button"
                          variant="outline"
                        >
                          Unblock
                        </Button>
                      </SocialRow>
                    );
                  })}
                </SocialSection>
              </>
            ) : overviewError === null ? (
              <p className="py-8 text-center text-sm font-medium text-[var(--chrome-muted)]">
                Friends are unavailable.
              </p>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function getRelationshipLabel(relationship: SocialRelationship) {
  switch (relationship) {
    case "friends":
      return "Friends";
    case "incoming-request":
      return "Sent you a friend request";
    case "outgoing-request":
      return "Friend request pending";
    case "none":
      return "Not connected";
  }
}

function RelationshipActions({
  isMutationPending,
  onAccept,
  onBlock,
  onCancel,
  onDecline,
  onRemove,
  onRequest,
  relationship,
  userId,
}: {
  isMutationPending: (key: string) => boolean;
  onAccept: () => Promise<boolean>;
  onBlock: () => void;
  onCancel: () => Promise<boolean>;
  onDecline: () => Promise<boolean>;
  onRemove: () => void;
  onRequest: () => Promise<boolean>;
  relationship: SocialRelationship;
  userId: string;
}) {
  const pending = isMutationPending(`relationship:${userId}`);
  const asyncClick = (action: () => Promise<boolean>) => () => void action();

  return (
    <>
      {relationship === "none" ? (
        <Button
          className="min-h-11"
          disabled={pending}
          onClick={asyncClick(onRequest)}
          type="button"
        >
          <UserPlusIcon data-icon="inline-start" />
          Add friend
        </Button>
      ) : null}
      {relationship === "incoming-request" ? (
        <>
          <Button
            className="min-h-11"
            disabled={pending}
            onClick={asyncClick(onAccept)}
            type="button"
          >
            Accept
          </Button>
          <Button
            className="min-h-11"
            disabled={pending}
            onClick={asyncClick(onDecline)}
            type="button"
            variant="outline"
          >
            Decline
          </Button>
        </>
      ) : null}
      {relationship === "outgoing-request" ? (
        <Button
          className="min-h-11"
          disabled={pending}
          onClick={asyncClick(onCancel)}
          type="button"
          variant="outline"
        >
          Cancel request
        </Button>
      ) : null}
      {relationship === "friends" ? (
        <Button
          className="min-h-11"
          disabled={pending}
          onClick={onRemove}
          type="button"
          variant="outline"
        >
          Remove
        </Button>
      ) : null}
      <Button
        className="min-h-11"
        disabled={pending}
        onClick={onBlock}
        type="button"
        variant="destructive"
      >
        Block
      </Button>
    </>
  );
}

function SocialSection({
  children,
  emptyMessage,
  id,
  itemCount,
  title,
  titleRef,
  titleTabIndex,
}: {
  children: ReactNode;
  emptyMessage: string;
  id: string;
  itemCount: number;
  title: string;
  titleRef?: Ref<HTMLHeadingElement>;
  titleTabIndex?: number;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-page)] p-4"
      data-testid={id}
    >
      <h2
        className="rounded-sm text-lg font-semibold outline-none focus:ring-3 focus:ring-[var(--chrome-focus-ring)]"
        id={`${id}-title`}
        ref={titleRef}
        tabIndex={titleTabIndex}
      >
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {itemCount > 0 ? (
          children
        ) : (
          <p className="text-sm font-medium text-[var(--chrome-muted)]">
            {emptyMessage}
          </p>
        )}
      </div>
    </section>
  );
}

function SocialRow({
  children,
  subtitle,
  subtitleAriaLive,
  subtitleId,
  testId,
  title,
}: {
  children: ReactNode;
  subtitle: string;
  subtitleAriaLive?: "assertive" | "off" | "polite";
  subtitleId?: string;
  testId?: string;
  title: string;
}) {
  return (
    <article
      className="flex flex-col gap-3 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid={testId}
    >
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold">{title}</h3>
        <p
          aria-live={subtitleAriaLive}
          className="mt-0.5 text-xs font-medium text-[var(--chrome-muted)]"
          id={subtitleId}
        >
          {subtitle}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">{children}</div>
    </article>
  );
}
