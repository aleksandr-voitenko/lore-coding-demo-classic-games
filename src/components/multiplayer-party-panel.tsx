"use client";

import { type Ref, useId } from "react";

import { Button } from "@/components/ui/button";
import {
  getPrivateRoomWatchingParticipantIds,
  type PrivateRoom,
  type PrivateRoomParticipant,
} from "@/lib/multiplayer/room";

export type MultiplayerPartyPanelProps = {
  activeParticipantId: string | null;
  actionsDisabled?: boolean;
  actionsDisabledDescriptionId?: string;
  membershipActionButtonRef?: Ref<HTMLButtonElement>;
  onCancelNextMatch: () => void;
  onJoinGame: (seatId: string) => void;
  onJoinNextMatch: () => void;
  onLeaveParty: () => void;
  onWatchInstead: (seatId: string) => void;
  pendingAction?: string | null;
  room: PrivateRoom;
};

export type MultiplayerPartyPanelParticipant = {
  displayName: string;
  id: string;
  isCurrent: boolean;
  isHost: boolean;
};

export type MultiplayerPartyPanelPlayerSlot = {
  participant: MultiplayerPartyPanelParticipant | null;
  seatId: string;
  seatLabel: string;
  slotNumber: number;
};

export type MultiplayerPartyPanelQueueEntry = {
  participant: MultiplayerPartyPanelParticipant;
  position: number;
};

export type MultiplayerPartyPanelMembershipAction =
  | {
      disabledReason: string | null;
      type: "cancel-next";
    }
  | {
      disabledReason: string | null;
      seatId: string;
      type: "join-game";
    }
  | {
      disabledReason: string | null;
      type: "join-next";
    }
  | {
      disabledReason: string | null;
      seatId: string;
      type: "watch-instead";
    };

export type MultiplayerPartyPanelViewModel = {
  activeParticipant: MultiplayerPartyPanelParticipant | null;
  activeQueuePosition: number | null;
  membershipAction: MultiplayerPartyPanelMembershipAction | null;
  nextMatchQueue: MultiplayerPartyPanelQueueEntry[];
  playerSlots: MultiplayerPartyPanelPlayerSlot[];
  watchers: MultiplayerPartyPanelParticipant[];
};

function toPanelParticipant(
  participant: PrivateRoomParticipant,
  activeParticipantId: string | null,
  hostParticipantId: string,
): MultiplayerPartyPanelParticipant {
  return {
    displayName: participant.displayName,
    id: participant.id,
    isCurrent: participant.id === activeParticipantId,
    isHost: participant.id === hostParticipantId,
  };
}

function getMembershipAction(
  room: PrivateRoom,
  activeParticipant: MultiplayerPartyPanelParticipant | null,
  activeSeatId: string | null,
  activeQueuePosition: number | null,
  openSeatId: string | null,
  watcherCount: number,
): MultiplayerPartyPanelMembershipAction | null {
  if (activeParticipant === null) {
    return null;
  }

  if (activeQueuePosition !== null) {
    return {
      disabledReason: null,
      type: "cancel-next",
    };
  }

  const isBetweenMatches = room.status === "lobby" || room.status === "finished";

  if (activeSeatId !== null) {
    if (!isBetweenMatches) {
      return null;
    }

    return {
      disabledReason:
        watcherCount >= room.observerLimit
          ? `Watching is full (${watcherCount} of ${room.observerLimit}).`
          : null,
      seatId: activeSeatId,
      type: "watch-instead",
    };
  }

  if (
    isBetweenMatches &&
    openSeatId !== null &&
    room.nextMatchParticipantIds.length === 0
  ) {
    return {
      disabledReason: null,
      seatId: openSeatId,
      type: "join-game",
    };
  }

  return {
    disabledReason:
      room.nextMatchParticipantIds.length >= room.observerLimit
        ? "The next-match queue is full."
        : null,
    type: "join-next",
  };
}

export function getMultiplayerPartyPanelViewModel(
  room: PrivateRoom,
  activeParticipantId: string | null,
): MultiplayerPartyPanelViewModel {
  const participantsById = new Map(
    room.participants.map((participant) => [
      participant.id,
      toPanelParticipant(
        participant,
        activeParticipantId,
        room.hostParticipantId,
      ),
    ]),
  );
  const playerSlots = room.seats.map((seat, index) => ({
    participant:
      seat.occupiedByParticipantId === null
        ? null
        : (participantsById.get(seat.occupiedByParticipantId) ?? null),
    seatId: seat.id,
    seatLabel: seat.label,
    slotNumber: index + 1,
  }));
  const watcherIds = getPrivateRoomWatchingParticipantIds(room);
  const watcherIdSet = new Set(watcherIds);
  const watchers = watcherIds.flatMap((participantId) => {
    const participant = participantsById.get(participantId);

    return participant === undefined ? [] : [participant];
  });
  const nextMatchQueue = room.nextMatchParticipantIds.flatMap(
    (participantId, index) => {
      const participant = participantsById.get(participantId);

      return participant === undefined || !watcherIdSet.has(participantId)
        ? []
        : [{ participant, position: index + 1 }];
    },
  );
  const activeParticipant =
    activeParticipantId === null
      ? null
      : (participantsById.get(activeParticipantId) ?? null);
  const activeSeatId =
    room.seats.find(
      (seat) => seat.occupiedByParticipantId === activeParticipant?.id,
    )?.id ?? null;
  const activeQueuePosition =
    nextMatchQueue.find(
      (entry) => entry.participant.id === activeParticipant?.id,
    )?.position ?? null;
  const openSeatId =
    room.seats.find((seat) => seat.occupiedByParticipantId === null)?.id ??
    null;

  return {
    activeParticipant,
    activeQueuePosition,
    membershipAction: getMembershipAction(
      room,
      activeParticipant,
      activeSeatId,
      activeQueuePosition,
      openSeatId,
      watchers.length,
    ),
    nextMatchQueue,
    playerSlots,
    watchers,
  };
}

export function MultiplayerPartyPanel({
  activeParticipantId,
  actionsDisabled = false,
  actionsDisabledDescriptionId,
  membershipActionButtonRef,
  onCancelNextMatch,
  onJoinGame,
  onJoinNextMatch,
  onLeaveParty,
  onWatchInstead,
  pendingAction = null,
  room,
}: MultiplayerPartyPanelProps) {
  const panelId = useId();
  const model = getMultiplayerPartyPanelViewModel(room, activeParticipantId);
  const actionDescriptionId = `${panelId}-action-description`;
  const actionsArePending = pendingAction !== null;
  const activeParticipantParticipation =
    model.activeParticipant === null
      ? null
      : model.playerSlots.some(
            (slot) => slot.participant?.id === model.activeParticipant?.id,
          )
        ? "Player"
        : "Watching";

  return (
    <section
      aria-labelledby={`${panelId}-title`}
      className="flex min-w-0 flex-col gap-4 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm"
      data-testid="multiplayer-party-panel"
    >
      <h2
        className="text-lg font-semibold tracking-normal"
        id={`${panelId}-title`}
      >
        Party
      </h2>

      <section aria-labelledby={`${panelId}-players-title`}>
        <h3
          className="text-sm font-semibold uppercase tracking-normal text-[var(--chrome-muted)]"
          id={`${panelId}-players-title`}
        >
          Players
        </h3>
        <ol
          className="mt-2 grid gap-2"
          data-testid="multiplayer-party-players"
        >
          {model.playerSlots.map((slot) => (
            <li
              className="rounded-md border border-[var(--chrome-border)] px-3 py-2"
              data-testid={`multiplayer-party-player-${slot.slotNumber}`}
              key={slot.seatId}
            >
              <div data-testid={`multiplayer-room-seat-${slot.seatId}`}>
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="font-semibold">Player {slot.slotNumber}</span>
                  {slot.participant?.isHost ? <ParticipantBadge label="Host" /> : null}
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--chrome-muted)]">
                  <ParticipantName participant={slot.participant} />
                  {slot.participant?.isCurrent ? <ParticipantBadge label="You" /> : null}
                </div>
                <p className="mt-1 truncate text-xs font-medium text-[var(--chrome-muted)]">
                  {slot.seatLabel}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby={`${panelId}-watchers-title`}>
        <div className="flex items-baseline justify-between gap-3">
          <h3
            className="text-sm font-semibold uppercase tracking-normal text-[var(--chrome-muted)]"
            id={`${panelId}-watchers-title`}
          >
            Watching
          </h3>
          <span
            aria-label={`${model.watchers.length} of ${room.observerLimit} watcher places used`}
            className="text-xs font-semibold text-[var(--chrome-muted)]"
            data-testid="multiplayer-party-watcher-count"
          >
            {model.watchers.length} of {room.observerLimit}
          </span>
        </div>
        {model.watchers.length === 0 ? (
          <p
            className="mt-2 text-sm font-medium text-[var(--chrome-muted)]"
            data-testid="multiplayer-party-watchers-empty"
          >
            No one watching.
          </p>
        ) : (
          <ul
            className="mt-2 grid gap-2"
            data-testid="multiplayer-party-watchers"
          >
            {model.watchers.map((participant) => (
              <li
                className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--chrome-border)] px-3 py-2"
                data-testid={`multiplayer-party-watcher-${participant.id}`}
                key={participant.id}
              >
                <ParticipantName participant={participant} />
                <div className="flex shrink-0 items-center gap-1">
                  {participant.isCurrent ? <ParticipantBadge label="You" /> : null}
                  {participant.isHost ? <ParticipantBadge label="Host" /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={`${panelId}-next-match-title`}>
        <h3
          className="text-sm font-semibold uppercase tracking-normal text-[var(--chrome-muted)]"
          id={`${panelId}-next-match-title`}
        >
          Next match
        </h3>
        {model.nextMatchQueue.length === 0 ? (
          <p
            className="mt-2 text-sm font-medium text-[var(--chrome-muted)]"
            data-testid="multiplayer-party-next-match-empty"
          >
            No one waiting.
          </p>
        ) : (
          <ol
            className="mt-2 grid list-decimal gap-2 pl-7"
            data-testid="multiplayer-party-next-match"
          >
            {model.nextMatchQueue.map(({ participant, position }) => (
              <li
                className="rounded-md border border-[var(--chrome-border)] px-3 py-2 pl-1"
                data-testid={`multiplayer-party-next-${participant.id}`}
                key={participant.id}
                value={position}
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <ParticipantName participant={participant} />
                  <div className="flex shrink-0 items-center gap-1">
                    {participant.isCurrent ? <ParticipantBadge label="You" /> : null}
                    {participant.isHost ? <ParticipantBadge label="Host" /> : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {model.activeParticipant !== null ? (
        <section
          aria-labelledby={`${panelId}-actions-title`}
          className="border-t border-[var(--chrome-border)] pt-4"
          data-testid="multiplayer-party-actions"
        >
          <h3 className="sr-only" id={`${panelId}-actions-title`}>
            Party actions
          </h3>
          <p
            className="mb-3 text-sm font-semibold text-[var(--chrome-ink)]"
            data-testid="multiplayer-room-current-participant"
          >
            {model.activeParticipant.displayName} · {activeParticipantParticipation}
            {model.activeParticipant.isHost ? " · Host" : ""}
          </p>
          {model.activeQueuePosition !== null ? (
            <p
              aria-atomic="true"
              className="mb-3 text-sm font-semibold text-[var(--chrome-ink)]"
              data-testid="multiplayer-party-queue-position"
              role="status"
            >
              Waiting for next match · Position {model.activeQueuePosition}
            </p>
          ) : null}
          {model.membershipAction?.disabledReason !== null &&
          model.membershipAction?.disabledReason !== undefined ? (
            <p
              className="mb-3 text-sm font-medium text-[var(--chrome-muted)]"
              data-testid="multiplayer-party-action-description"
              id={actionDescriptionId}
            >
              {model.membershipAction.disabledReason}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {model.membershipAction !== null ? (
              <MembershipActionButton
                action={model.membershipAction}
                actionsDisabled={actionsDisabled}
                actionsDisabledDescriptionId={actionsDisabledDescriptionId}
                descriptionId={actionDescriptionId}
                membershipActionButtonRef={membershipActionButtonRef}
                onCancelNextMatch={onCancelNextMatch}
                onJoinGame={onJoinGame}
                onJoinNextMatch={onJoinNextMatch}
                onWatchInstead={onWatchInstead}
                pendingAction={pendingAction}
              />
            ) : null}
            <Button
              aria-describedby={
                actionsDisabled ? actionsDisabledDescriptionId : undefined
              }
              className="min-h-11 w-full sm:w-auto"
              data-testid="multiplayer-party-leave-button"
              disabled={actionsDisabled || actionsArePending}
              onClick={onLeaveParty}
              size="lg"
              type="button"
              variant="destructive"
            >
              {pendingAction === "room.leave" ? "Leaving..." : "Leave party"}
            </Button>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function ParticipantBadge({ label }: { label: "Host" | "You" }) {
  return (
    <span className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-accent-faint)] px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-normal text-[var(--chrome-ink)]">
      {label}
    </span>
  );
}

function ParticipantName({
  participant,
}: {
  participant: MultiplayerPartyPanelParticipant | null;
}) {
  return (
    <span
      className="min-w-0 truncate font-semibold"
      title={participant?.displayName}
    >
      {participant?.displayName ?? "Open"}
    </span>
  );
}

type MembershipActionButtonProps = Pick<
  MultiplayerPartyPanelProps,
  | "onCancelNextMatch"
  | "onJoinGame"
  | "onJoinNextMatch"
  | "onWatchInstead"
> & {
  action: MultiplayerPartyPanelMembershipAction;
  actionsDisabled: boolean;
  actionsDisabledDescriptionId?: string;
  descriptionId: string;
  membershipActionButtonRef?: Ref<HTMLButtonElement>;
  pendingAction: string | null;
};

function MembershipActionButton({
  action,
  actionsDisabled,
  actionsDisabledDescriptionId,
  descriptionId,
  membershipActionButtonRef,
  onCancelNextMatch,
  onJoinGame,
  onJoinNextMatch,
  onWatchInstead,
  pendingAction,
}: MembershipActionButtonProps) {
  const actionConfig = getMembershipActionButtonConfig(action);
  const isPending = pendingAction === actionConfig.pendingActionKey;

  return (
    <Button
      aria-describedby={
        actionsDisabled
          ? actionsDisabledDescriptionId
          : action.disabledReason === null
            ? undefined
            : descriptionId
      }
      className="min-h-11 w-full sm:w-auto"
      data-testid={actionConfig.testId}
      disabled={
        actionsDisabled || pendingAction !== null || action.disabledReason !== null
      }
      onClick={() => {
        if (action.type === "cancel-next") {
          onCancelNextMatch();
        } else if (action.type === "join-next") {
          onJoinNextMatch();
        } else if (action.type === "join-game") {
          onJoinGame(action.seatId);
        } else {
          onWatchInstead(action.seatId);
        }
      }}
      ref={membershipActionButtonRef}
      size="lg"
      type="button"
      variant={action.type === "cancel-next" ? "outline" : "default"}
    >
      {isPending ? actionConfig.pendingLabel : actionConfig.label}
    </Button>
  );
}

function getMembershipActionButtonConfig(
  action: MultiplayerPartyPanelMembershipAction,
) {
  if (action.type === "cancel-next") {
    return {
      label: "Cancel request",
      pendingActionKey: "room.cancelNextMatch",
      pendingLabel: "Cancelling...",
      testId: "multiplayer-party-cancel-next-button",
    };
  }

  if (action.type === "join-game") {
    return {
      label: "Join game",
      pendingActionKey: `room.claimSeat:${action.seatId}`,
      pendingLabel: "Joining...",
      testId: "multiplayer-party-join-game-button",
    };
  }

  if (action.type === "join-next") {
    return {
      label: "Join next match",
      pendingActionKey: "room.joinNextMatch",
      pendingLabel: "Joining...",
      testId: "multiplayer-party-join-next-button",
    };
  }

  return {
    label: "Watch instead",
    pendingActionKey: `room.releaseSeat:${action.seatId}`,
    pendingLabel: "Switching...",
    testId: "multiplayer-party-watch-instead-button",
  };
}
