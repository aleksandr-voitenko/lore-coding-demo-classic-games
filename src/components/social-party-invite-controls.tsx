"use client";

import { EyeIcon, Gamepad2Icon, UserPlusIcon } from "lucide-react";
import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { useSocial } from "@/components/social-provider";
import { Button } from "@/components/ui/button";
import type {
  PartyInvitationIntent,
  SocialAvailability,
  SocialFriend,
  SocialOverview,
  SocialPartyInvitation,
} from "@/lib/social";
import {
  cancelSocialPartyInvitation,
  createSocialPartyInvitation,
  SocialClientError,
  type SocialPartyInvitationCreation,
} from "@/lib/social-client";
import {
  getPrivateRoomGuestPlayerAdmissionRole,
  getPrivateRoomWatchingParticipantIds,
  type PrivateRoom,
  type PrivateRoomParticipantRole,
} from "@/lib/multiplayer/room";

export type SocialPartyInviteControlsProps = {
  actionsDisabled?: boolean;
  actionsDisabledDescriptionId?: string;
  room: PrivateRoom;
};

type ActiveInvitationAction = "cancel" | PartyInvitationIntent;

type PendingFocusTarget = "cancel" | "status";

export type TrackedPartyInvitation = {
  invitation: SocialPartyInvitation;
  reconcileAfterRequestGeneration: number | null;
};

type SocialPartyInviteRowBase = {
  friend: SocialFriend;
  statusLabel: string;
};

export type SocialPartyInviteRow =
  | (SocialPartyInviteRowBase & {
      kind: "available";
      playAdmissionRole: "observer" | "player";
      playDisabledReason: string | null;
      watchDisabledReason: string | null;
    })
  | (SocialPartyInviteRowBase & {
      invitation: SocialPartyInvitation;
      kind: "pending";
    })
  | (SocialPartyInviteRowBase & {
      kind: "same-party";
      role: PrivateRoomParticipantRole;
    })
  | (SocialPartyInviteRowBase & {
      availability: Exclude<SocialAvailability, "available">;
      kind: "unavailable";
    });

function areStringArraysEqual(
  previous: readonly string[],
  next: readonly string[],
) {
  return (
    previous.length === next.length &&
    previous.every((value, index) => value === next[index])
  );
}

function areInviteRelevantRoomsEqual(
  previous: PrivateRoom,
  next: PrivateRoom,
) {
  return (
    previous.code === next.code &&
    previous.observerLimit === next.observerLimit &&
    previous.status === next.status &&
    areStringArraysEqual(
      previous.nextMatchParticipantIds,
      next.nextMatchParticipantIds,
    ) &&
    previous.seats.length === next.seats.length &&
    previous.seats.every((seat, index) => {
      const nextSeat = next.seats[index];

      return (
        nextSeat !== undefined &&
        seat.id === nextSeat.id &&
        seat.occupiedByParticipantId === nextSeat.occupiedByParticipantId
      );
    }) &&
    previous.participants.length === next.participants.length &&
    previous.participants.every((participant, index) => {
      const nextParticipant = next.participants[index];

      return (
        nextParticipant !== undefined &&
        participant.id === nextParticipant.id &&
        participant.role === nextParticipant.role &&
        participant.userId === nextParticipant.userId
      );
    })
  );
}

export function areSocialPartyInviteControlPropsEqual(
  previous: SocialPartyInviteControlsProps,
  next: SocialPartyInviteControlsProps,
) {
  return (
    previous.actionsDisabled === next.actionsDisabled &&
    previous.actionsDisabledDescriptionId ===
      next.actionsDisabledDescriptionId &&
    areInviteRelevantRoomsEqual(previous.room, next.room)
  );
}

function getUnavailableStatusLabel(
  availability: Exclude<SocialAvailability, "available">,
) {
  switch (availability) {
    case "busy":
      return "Busy";
    case "in-party":
      return "In another party";
    case "offline":
      return "Offline";
    case "unknown":
      return "Checking status";
  }
}

export function getSocialPartyInviteRows({
  currentPartyInvitations,
  friends,
  room,
}: {
  currentPartyInvitations: readonly SocialPartyInvitation[];
  friends: readonly SocialFriend[];
  room: PrivateRoom;
}): SocialPartyInviteRow[] {
  const participantsByUserId = new Map(
    room.participants.flatMap((participant) =>
      participant.userId === null
        ? []
        : [[participant.userId, participant] as const],
    ),
  );
  const invitationsByRecipientId = new Map(
    currentPartyInvitations.map((invitation) => [
      invitation.recipient.id,
      invitation,
    ]),
  );
  const watcherLimitReached =
    getPrivateRoomWatchingParticipantIds(room).length >= room.observerLimit;
  const playAdmissionRole = getPrivateRoomGuestPlayerAdmissionRole(room);

  return friends.map((friend) => {
    const partyParticipant = participantsByUserId.get(friend.user.id);

    if (partyParticipant !== undefined) {
      return {
        friend,
        kind: "same-party",
        role: partyParticipant.role,
        statusLabel: "In this party",
      };
    }

    const pendingInvitation = invitationsByRecipientId.get(friend.user.id);

    if (pendingInvitation !== undefined) {
      return {
        friend,
        invitation: pendingInvitation,
        kind: "pending",
        statusLabel: `${getInvitationIntentLabel(pendingInvitation.intent)} invitation pending`,
      };
    }

    if (friend.availability !== "available") {
      return {
        availability: friend.availability,
        friend,
        kind: "unavailable",
        statusLabel: getUnavailableStatusLabel(friend.availability),
      };
    }

    const playDisabledReason =
      watcherLimitReached && playAdmissionRole === "observer"
        ? "Party full"
        : null;
    const watchDisabledReason = watcherLimitReached ? "Watching full" : null;
    const statusLabel =
      playDisabledReason !== null
        ? playDisabledReason
        : watchDisabledReason !== null
          ? "Watching full · Player spot open"
          : playAdmissionRole === "observer"
            ? "Available · Play offers Watching"
            : "Available · Player spot open";

    return {
      friend,
      kind: "available",
      playAdmissionRole,
      playDisabledReason,
      statusLabel,
      watchDisabledReason,
    };
  });
}

export function reconcileCurrentPartyInvitations({
  overview,
  overviewRequestGeneration,
  trackedPartyInvitations,
}: {
  overview: SocialOverview | null;
  overviewRequestGeneration: number | null;
  trackedPartyInvitations: readonly TrackedPartyInvitation[];
}) {
  if (overview === null || overviewRequestGeneration === null) {
    return trackedPartyInvitations.map(({ invitation }) => invitation);
  }

  const outgoingInvitationIds = new Set(
    overview.outgoingPartyInvitations.map((invitation) => invitation.id),
  );

  return trackedPartyInvitations.flatMap(
    ({ invitation, reconcileAfterRequestGeneration }) =>
      reconcileAfterRequestGeneration === null ||
      overviewRequestGeneration < reconcileAfterRequestGeneration ||
      outgoingInvitationIds.has(invitation.id)
        ? [invitation]
        : [],
  );
}

function getInvitationIntentLabel(intent: PartyInvitationIntent) {
  return intent === "play" ? "Play" : "Watch";
}

export function getSocialPartyInvitationFeedback(
  creation: SocialPartyInvitationCreation,
  displayName: string,
) {
  const intentLabel = getInvitationIntentLabel(creation.invitation.intent);
  const status = creation.created
    ? `${intentLabel} invite sent to ${displayName}.`
    : `${intentLabel} invite to ${displayName} is already pending.`;

  if (creation.invitation.intent === "watch") {
    return `${status} Watching is currently available; capacity will be checked again when they accept.`;
  }

  return creation.admissionRole === "observer"
    ? `${status} The current offer is Watching because no player spot is available; capacity will be checked again when they accept.`
    : `${status} A player spot is currently available; the party will check again when they accept and may offer Watching if capacity allows.`;
}

export function formatSocialPartyInviteError(error: unknown) {
  if (error instanceof SocialClientError && error.retryAfterSeconds !== null) {
    return `${error.message} Try again in ${error.retryAfterSeconds} seconds.`;
  }

  return error instanceof Error
    ? error.message
    : "The invitation could not be sent.";
}

function isResolvedPartyInvitationError(error: unknown) {
  return (
    error instanceof SocialClientError &&
    (error.code === "party-invitation-expired" ||
      error.code === "party-invitation-not-found" ||
      error.code === "party-invitation-not-pending")
  );
}

function setElementRef<Element extends HTMLElement>(
  refs: Map<string, Element>,
  userId: string,
  element: Element | null,
) {
  if (element === null) {
    refs.delete(userId);
  } else {
    refs.set(userId, element);
  }
}

function SocialPartyInviteControlsView({
  actionsDisabled = false,
  actionsDisabledDescriptionId,
  room,
}: SocialPartyInviteControlsProps) {
  const {
    isEnabled,
    isLoading,
    isMutationPending,
    openSocialCenter,
    overview,
    overviewError,
    overviewRequestGeneration,
    refresh,
    refreshWithGeneration,
    runMutation,
  } = useSocial();
  const disabledActionsId = useId();
  const helpId = useId();
  const titleId = useId();
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeActions, setActiveActions] = useState<
    Record<string, ActiveInvitationAction>
  >({});
  const [focusRequestVersion, setFocusRequestVersion] = useState(0);
  const [currentPartyInvitations, setCurrentPartyInvitations] = useState<
    Record<string, TrackedPartyInvitation>
  >({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const cancelButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusedCancelButtonRef = useRef<{
    button: HTMLButtonElement;
    userId: string;
  } | null>(null);
  const panelHeadingRef = useRef<HTMLHeadingElement>(null);
  const rowStatusRefs = useRef(new Map<string, HTMLParagraphElement>());
  const pendingFocusRef = useRef<{
    target: PendingFocusTarget;
    userId: string;
  } | null>(null);
  const trackedPartyInvitationList = useMemo(
    () => Object.values(currentPartyInvitations),
    [currentPartyInvitations],
  );
  const invitationReconciliation = useMemo(
    () =>
      reconcileCurrentPartyInvitations({
        overview,
        overviewRequestGeneration,
        trackedPartyInvitations: trackedPartyInvitationList,
      }),
    [overview, overviewRequestGeneration, trackedPartyInvitationList],
  );
  const rows = useMemo(
    () =>
      getSocialPartyInviteRows({
        currentPartyInvitations: invitationReconciliation,
        friends: overview?.friends ?? [],
        room,
      }),
    [invitationReconciliation, overview?.friends, room],
  );

  useEffect(() => {
    const nextExpiration = trackedPartyInvitationList.reduce<number | null>(
      (earliest, { invitation }) => {
        const expiresAt = Date.parse(invitation.expiresAt);

        return earliest === null || expiresAt < earliest ? expiresAt : earliest;
      },
      null,
    );

    if (nextExpiration === null) {
      return;
    }

    const timeout = setTimeout(() => {
      const now = Date.now();

      setCurrentPartyInvitations((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([, trackedInvitation]) =>
              Date.parse(trackedInvitation.invitation.expiresAt) > now,
          ),
        ),
      );
    }, Math.min(Math.max(nextExpiration - Date.now() + 25, 0), 2_147_483_647));

    return () => clearTimeout(timeout);
  }, [trackedPartyInvitationList]);

  useEffect(() => {
    const pendingFocus = pendingFocusRef.current;

    if (pendingFocus === null) {
      return;
    }

    pendingFocusRef.current = null;
    queueMicrotask(() => {
      const cancelButton =
        pendingFocus.target === "cancel"
          ? cancelButtonRefs.current.get(pendingFocus.userId)
          : undefined;

      if (cancelButton !== undefined && !cancelButton.disabled) {
        cancelButton.focus();
        return;
      }

      const rowStatus = rowStatusRefs.current.get(pendingFocus.userId);

      if (rowStatus !== undefined) {
        rowStatus.focus();
      } else {
        panelHeadingRef.current?.focus();
      }
    });
  }, [focusRequestVersion]);

  useEffect(() => {
    const focusedCancelButton = focusedCancelButtonRef.current;

    if (
      focusedCancelButton === null ||
      focusedCancelButton.button.isConnected
    ) {
      return;
    }

    focusedCancelButtonRef.current = null;

    if (!document.hasFocus()) {
      return;
    }

    const rowStatus = rowStatusRefs.current.get(focusedCancelButton.userId);

    if (rowStatus !== undefined) {
      rowStatus.focus();
    } else {
      panelHeadingRef.current?.focus();
    }
  }, [rows]);

  if (!isEnabled) {
    return null;
  }

  function setActiveAction(
    userId: string,
    action: ActiveInvitationAction | null,
  ) {
    setActiveActions((current) => {
      const next = { ...current };

      if (action === null) {
        delete next[userId];
      } else {
        next[userId] = action;
      }

      return next;
    });
  }

  function requestRowFocus(userId: string, target: PendingFocusTarget) {
    pendingFocusRef.current = { target, userId };
    setFocusRequestVersion((current) => current + 1);
  }

  function removeCurrentPartyInvitation(
    userId: string,
    invitationId: string,
  ) {
    setCurrentPartyInvitations((current) => {
      if (current[userId]?.invitation.id !== invitationId) {
        return current;
      }

      const next = { ...current };
      delete next[userId];
      return next;
    });
  }

  async function sendInvitation(
    friend: SocialFriend,
    intent: PartyInvitationIntent,
  ) {
    const mutationKey = `party-invitation:${friend.user.id}`;
    let creation: SocialPartyInvitationCreation | null = null;

    setActionError(null);
    setStatusMessage(null);
    setActiveAction(friend.user.id, intent);

    try {
      const invitationCreation = await runMutation(mutationKey, () =>
        createSocialPartyInvitation({
          intent,
          partyCode: room.code,
          recipientUserId: friend.user.id,
        }),
      );
      creation = invitationCreation;
      setCurrentPartyInvitations((current) => ({
        ...current,
        [friend.user.id]: {
          invitation: invitationCreation.invitation,
          reconcileAfterRequestGeneration: null,
        },
      }));
      setStatusMessage(
        getSocialPartyInvitationFeedback(
          invitationCreation,
          friend.user.displayName,
        ),
      );
    } catch (error) {
      setActionError(formatSocialPartyInviteError(error));
    } finally {
      setActiveAction(friend.user.id, null);

      if (creation !== null) {
        requestRowFocus(friend.user.id, "cancel");
      }
    }

    const completedCreation = creation;

    if (completedCreation === null) {
      return;
    }

    const refreshResult = await refreshWithGeneration();

    setCurrentPartyInvitations((current) => {
      const trackedInvitation = current[friend.user.id];

      return trackedInvitation?.invitation.id ===
        completedCreation.invitation.id
        ? {
            ...current,
            [friend.user.id]: {
              ...trackedInvitation,
              reconcileAfterRequestGeneration:
                refreshResult.requestGeneration,
            },
          }
        : current;
    });
  }

  async function cancelInvitation(row: Extract<SocialPartyInviteRow, { kind: "pending" }>) {
    const userId = row.friend.user.id;
    const mutationKey = `party-invitation:${userId}`;
    let invitationRemoved = false;

    setActionError(null);
    setStatusMessage(null);
    setActiveAction(userId, "cancel");

    try {
      await runMutation(mutationKey, () =>
        cancelSocialPartyInvitation(row.invitation.id),
      );
      invitationRemoved = true;
      setStatusMessage(
        `${getInvitationIntentLabel(row.invitation.intent)} invitation to ${row.friend.user.displayName} canceled.`,
      );
    } catch (error) {
      if (isResolvedPartyInvitationError(error)) {
        invitationRemoved = true;
        setStatusMessage(
          `${getInvitationIntentLabel(row.invitation.intent)} invitation to ${row.friend.user.displayName} is no longer pending.`,
        );
      } else {
        setActionError(formatSocialPartyInviteError(error));
      }
    } finally {
      if (invitationRemoved) {
        removeCurrentPartyInvitation(userId, row.invitation.id);
      }

      setActiveAction(userId, null);

      if (invitationRemoved) {
        requestRowFocus(userId, "status");
      }
    }

  }
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm"
      data-testid="social-party-invite-controls"
    >
      <h2
        className="text-lg font-semibold tracking-normal outline-none"
        id={titleId}
        ref={panelHeadingRef}
        tabIndex={-1}
      >
        Invite friends
      </h2>
      <p
        className="mt-1 text-sm font-medium text-[var(--chrome-muted)]"
        id={helpId}
      >
        Play currently offers an open player spot or Watching. Watch offers
        Watching. Capacity is checked again when the invitation is accepted,
        and watchers can request the next match after joining.
      </p>

      {actionsDisabled ? (
        <p
          className="mt-3 text-sm font-semibold text-[var(--chrome-muted)]"
          id={disabledActionsId}
        >
          Reconnect to invite friends.
        </p>
      ) : null}
      {overviewError !== null ? (
        <div
          className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3"
          role="alert"
        >
          <p className="text-sm font-medium">
            {formatSocialPartyInviteError(overviewError)}
          </p>
          <Button
            className="mt-2 min-h-11"
            onClick={() => void refresh()}
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      ) : null}
      {actionError !== null ? (
        <p
          className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive"
          data-testid="social-party-invite-error"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}
      {statusMessage !== null ? (
        <p
          className="mt-3 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-accent-faint)] p-3 text-sm font-medium"
          data-testid="social-party-invite-status"
          role="status"
        >
          {statusMessage}
        </p>
      ) : null}

      {isLoading && overview === null ? (
        <p className="mt-4 text-sm font-medium text-[var(--chrome-muted)]">
          Loading friends...
        </p>
      ) : overview === null ? null : rows.length === 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-[var(--chrome-muted)]">
            No friends yet. Open Friends to add someone.
          </p>
          <Button
            className="mt-3 min-h-11"
            onClick={openSocialCenter}
            type="button"
            variant="outline"
          >
            <UserPlusIcon data-icon="inline-start" />
            Open Friends
          </Button>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3" data-testid="social-party-invite-friends">
          {rows.map((row) => {
            const userId = row.friend.user.id;
            const mutationKey = `party-invitation:${userId}`;
            const mutationPending = isMutationPending(mutationKey);
            const activeAction = activeActions[userId];
            const statusId = `social-party-invite-${userId}-status`;
            const describedBy = [
              statusId,
              helpId,
              actionsDisabled
                ? actionsDisabledDescriptionId ?? disabledActionsId
                : undefined,
            ]
              .filter((value): value is string => value !== undefined)
              .join(" ");
            const statusLabel =
              activeAction === "play" || activeAction === "watch"
                ? `Sending ${getInvitationIntentLabel(activeAction)} invitation...`
                : activeAction === "cancel"
                  ? "Canceling invitation..."
                  : row.statusLabel;

            return (
              <li
                className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-page)] p-3"
                data-testid={`social-party-invite-friend-${userId}`}
                key={userId}
              >
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">
                      {row.friend.user.displayName}
                    </h3>
                    <p
                      className="mt-0.5 text-xs font-medium text-[var(--chrome-muted)]"
                      id={statusId}
                      ref={(status) =>
                        setElementRef(rowStatusRefs.current, userId, status)
                      }
                      tabIndex={-1}
                    >
                      {statusLabel}
                    </p>
                  </div>

                  {row.kind === "pending" ? (
                    <Button
                      aria-describedby={describedBy}
                      aria-label={`Cancel ${row.invitation.intent} invitation to ${row.friend.user.displayName}`}
                      className="min-h-11 w-full"
                      disabled={actionsDisabled || mutationPending}
                      onBlur={(event) => {
                        const button = event.currentTarget;

                        queueMicrotask(() => {
                          if (
                            button.isConnected &&
                            focusedCancelButtonRef.current?.button === button
                          ) {
                            focusedCancelButtonRef.current = null;
                          }
                        });
                      }}
                      onClick={() => void cancelInvitation(row)}
                      onFocus={(event) => {
                        focusedCancelButtonRef.current = {
                          button: event.currentTarget,
                          userId,
                        };
                      }}
                      ref={(button) =>
                        setElementRef(cancelButtonRefs.current, userId, button)
                      }
                      type="button"
                      variant="outline"
                    >
                      {activeAction === "cancel"
                        ? "Canceling..."
                        : "Cancel invitation"}
                    </Button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        aria-describedby={describedBy}
                        aria-label={`Invite ${row.friend.user.displayName} to play`}
                        className="min-h-11"
                        disabled={
                          actionsDisabled ||
                          mutationPending ||
                          row.kind !== "available" ||
                          row.playDisabledReason !== null
                        }
                        onClick={() => void sendInvitation(row.friend, "play")}
                        type="button"
                      >
                        <Gamepad2Icon data-icon="inline-start" />
                        Play
                      </Button>
                      <Button
                        aria-describedby={describedBy}
                        aria-label={`Invite ${row.friend.user.displayName} to watch`}
                        className="min-h-11"
                        disabled={
                          actionsDisabled ||
                          mutationPending ||
                          row.kind !== "available" ||
                          row.watchDisabledReason !== null
                        }
                        onClick={() => void sendInvitation(row.friend, "watch")}
                        type="button"
                        variant="outline"
                      >
                        <EyeIcon data-icon="inline-start" />
                        Watch
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export const SocialPartyInviteControls = memo(
  SocialPartyInviteControlsView,
  areSocialPartyInviteControlPropsEqual,
);

SocialPartyInviteControls.displayName = "SocialPartyInviteControls";
