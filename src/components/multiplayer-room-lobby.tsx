"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  ArrowLeftIcon,
  CopyIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import {
  type ComponentType,
  type FormEvent,
  type Ref,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  MultiplayerPartyPanel,
} from "@/components/multiplayer-party-panel";
import {
  MultiplayerRoomGameRendererView,
  getMultiplayerRoomGameRenderer,
} from "@/components/multiplayer-room-game-registry";
import {
  MultiplayerRoomDiagnosticsOverlay,
  useMultiplayerRoomDiagnostics,
  useMultiplayerRoomDiagnosticsMode,
} from "@/components/multiplayer-room-diagnostics";
import {
  MultiplayerRoomRequestError,
  getMultiplayerRoomStreamUnavailableMessage,
  getMultiplayerRoomRequestErrorMessage,
  type MultiplayerRoomClientSnapshot,
  useMultiplayerRoomClient,
} from "@/components/multiplayer-room-client";
import {
  removeMultiplayerRoomParticipantCredentials,
  writeMultiplayerRoomParticipantCredentials,
} from "@/components/multiplayer-room-participant-credentials";
import {
  MultiplayerRoomTransportError,
  type MultiplayerRoomMembershipEnded,
} from "@/components/multiplayer-room-transport";
import type { SocialPartyInviteControlsProps } from "@/components/social-party-invite-controls";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { UserAccountControls } from "@/components/user-account-controls";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatGameCatalogLabel, type GameId } from "@/lib/game-catalog";
import {
  DEFAULT_MULTIPLAYER_GAME_ID,
  MULTIPLAYER_GAME_IDS,
  isMultiplayerGameId,
  type MultiplayerGameId,
} from "@/lib/multiplayer/game-registry";
import {
  getPrivateRoomGuestPlayerAdmissionRole,
  getPrivateRoomInvitePath,
  getPrivateRoomWatchingParticipantIds,
  normalizePrivateRoomCode,
  normalizePrivateRoomDisplayName,
  type PrivateRoom,
  type PrivateRoomStatus,
} from "@/lib/multiplayer/room";
import type {
  MultiplayerGameInputPayload,
  MultiplayerRoomGameSnapshot,
  MultiplayerRoomSnapshot,
  PrivateRoomLifecycleCommand,
} from "@/lib/multiplayer/protocol";
import {
  MAX_USER_DISPLAY_NAME_LENGTH,
  type UserAuthMode,
} from "@/lib/user-profile";

const MULTIPLAYER_ROOM_ABANDONED_MESSAGE =
  "Room connection lost. This room is no longer available, so the in-progress game cannot continue. Start or join a new room.";
const MULTIPLAYER_ROOM_EXPIRED_MESSAGE =
  "This room expired after being inactive. Start or join a new room.";
const MULTIPLAYER_PARTY_LEFT_MESSAGE =
  "You left the party. Return to the library when you are ready to play again.";
const MULTIPLAYER_ROOM_CONNECTION_STATUS_ID =
  "multiplayer-room-connection-status";

type MultiplayerRoomLobbyProps = {
  focusHeadingOnMount?: boolean;
  initialAuthMode?: UserAuthMode | null;
  initialGame?: MultiplayerRoomGameSnapshot | null;
  initialJoinOutcomeMessage?: string | null;
  initialParticipantCapability?: string | null;
  initialParticipantId?: string | null;
  initialRoom?: PrivateRoom | null;
  initialSeq?: number;
  initialRoomCode: string;
  onBackToLibrary: () => void;
  socialCenterTrigger?: ReactNode;
  socialPartyInviteControls?: ComponentType<SocialPartyInviteControlsProps>;
};

type GuestJoinFormProps = {
  connectionDescriptionId?: string;
  displayName: string;
  error: string | null;
  isJoining: boolean;
  joinGameDisabled: boolean;
  onDisplayNameChange: (value: string) => void;
  onJoinGame: (event: FormEvent<HTMLFormElement>) => void;
  onWatch: () => void;
  watchDisabled: boolean;
  watcherLimitMessage: string | null;
};

type HostLifecycleControlsProps = {
  gameId: GameId;
  onLifecycleCommand: (command: PrivateRoomLifecycleCommand) => void;
  onReplaceMatch: (gameId: MultiplayerGameId) => void;
  pendingAction: string | null;
  status: PrivateRoomStatus;
};

type RoomSummaryProps = {
  copyStatus: string | null;
  gameHeadingRef: Ref<HTMLHeadingElement>;
  inviteLink: string;
  onCopyInviteLink: () => void;
  room: PrivateRoom;
};

type MultiplayerRoomTransitionState = {
  gameId: GameId;
  matchId: number;
  status: PrivateRoomStatus;
};

type MultiplayerRoomTransitionAnnouncementState = {
  activeSlot: 0 | 1;
  message: string | null;
};

const INITIAL_MULTIPLAYER_ROOM_TRANSITION_ANNOUNCEMENT = {
  activeSlot: 1,
  message: null,
} satisfies MultiplayerRoomTransitionAnnouncementState;

export function getMultiplayerRoomConnectionErrorState(error: unknown) {
  const expiredRoom =
    error instanceof MultiplayerRoomTransportError &&
    error.code === "room-expired";
  const abandonRoom =
    error instanceof MultiplayerRoomTransportError &&
    (expiredRoom || error.code === "room-not-found");

  return {
    abandonRoom,
    message: expiredRoom
      ? MULTIPLAYER_ROOM_EXPIRED_MESSAGE
      : abandonRoom
        ? MULTIPLAYER_ROOM_ABANDONED_MESSAGE
        : getMultiplayerRoomRequestErrorMessage(error),
  };
}

function getParticipantById(room: PrivateRoom | null, participantId: string | null) {
  if (room === null || participantId === null) {
    return null;
  }

  return room.participants.find((participant) => participant.id === participantId) ?? null;
}

function formatRoomSettingLabel(key: string) {
  return key
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatRoomSettingValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "On" : "Off";
  }

  if (value === null || value === undefined) {
    return "None";
  }

  if (typeof value === "string") {
    return value.replace("x", " x ");
  }

  if (typeof value === "number") {
    return String(value);
  }

  return JSON.stringify(value);
}

function getStatusLabel(status: PrivateRoomStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getMultiplayerRoomTransitionState(
  room: PrivateRoom,
): MultiplayerRoomTransitionState {
  return {
    gameId: room.settings.gameId,
    matchId: room.matchId,
    status: room.status,
  };
}

export function getMultiplayerRoomTransitionAnnouncement(
  previous: MultiplayerRoomTransitionState,
  next: MultiplayerRoomTransitionState,
) {
  const gameLabel = formatGameCatalogLabel(next.gameId);

  if (next.matchId !== previous.matchId) {
    if (next.gameId !== previous.gameId) {
      return `${gameLabel} is now the party game. You are still in the same party.`;
    }

    return next.status === "running"
      ? `A new ${gameLabel} match started. You are still in the same party.`
      : `A new ${gameLabel} match is ready. You are still in the same party.`;
  }

  if (next.status === previous.status) {
    return null;
  }

  if (next.status === "running") {
    return previous.status === "paused"
      ? `${gameLabel} resumed.`
      : `${gameLabel} started.`;
  }

  if (next.status === "paused") {
    return `${gameLabel} paused.`;
  }

  if (next.status === "finished") {
    return `${gameLabel} finished. The party can choose another game.`;
  }

  return null;
}

export function advanceMultiplayerRoomTransitionAnnouncement(
  current: MultiplayerRoomTransitionAnnouncementState,
  message: string,
): MultiplayerRoomTransitionAnnouncementState {
  return {
    activeSlot: current.activeSlot === 0 ? 1 : 0,
    message,
  };
}

function getLifecycleActions(status: PrivateRoomStatus) {
  if (status === "lobby") {
    return [{ command: "start", label: "Start", icon: PlayIcon }] as const;
  }

  if (status === "running") {
    return [
      { command: "pause", label: "Pause", icon: PauseIcon },
      { command: "restart", label: "Restart", icon: RotateCcwIcon },
    ] as const;
  }

  if (status === "paused") {
    return [
      { command: "resume", label: "Resume", icon: PlayIcon },
      { command: "restart", label: "Restart", icon: RotateCcwIcon },
    ] as const;
  }

  return [{ command: "restart", label: "Restart", icon: RotateCcwIcon }] as const;
}

export function getPrivateRoomShareLink(
  roomCode: string | null,
  origin: string | null,
) {
  const invitePath = getPrivateRoomInvitePath(roomCode) ?? "/?room=";

  if (origin === null || origin.trim().length === 0) {
    return invitePath;
  }

  try {
    return new URL(invitePath, origin).toString();
  } catch {
    return invitePath;
  }
}

function getBrowserOrigin() {
  return typeof window === "undefined" ? null : window.location.origin;
}

function subscribeBrowserOrigin() {
  return () => {};
}

export function selectFreshMultiplayerRoomSnapshot<
  Snapshot extends Pick<MultiplayerRoomSnapshot, "game" | "room" | "seq">,
>(current: Snapshot | null, next: Snapshot) {
  if (current === null || next.seq > current.seq) {
    return next;
  }

  if (next.seq < current.seq) {
    return current;
  }

  if (next.room.matchId !== current.room.matchId) {
    return current;
  }

  const currentGameSeq = current.game?.seq ?? -1;
  const nextGameSeq = next.game?.seq ?? -1;

  return nextGameSeq > currentGameSeq ? next : current;
}

export function MultiplayerRoomLobby({
  focusHeadingOnMount = false,
  initialAuthMode = null,
  initialGame = null,
  initialJoinOutcomeMessage = null,
  initialParticipantCapability = null,
  initialParticipantId = null,
  initialRoom = null,
  initialSeq = 0,
  initialRoomCode,
  onBackToLibrary,
  socialCenterTrigger,
  socialPartyInviteControls: SocialPartyInviteControlsView,
}: MultiplayerRoomLobbyProps) {
  const { user } = useCurrentUser();
  const normalizedRoomCode = normalizePrivateRoomCode(initialRoomCode);
  const browserOrigin = useSyncExternalStore(
    subscribeBrowserOrigin,
    getBrowserOrigin,
    () => null,
  );
  const userId = user?.id ?? null;
  const diagnosticsMode = useMultiplayerRoomDiagnosticsMode();
  const diagnostics = useMultiplayerRoomDiagnostics({
    enabled: diagnosticsMode.enabled,
    log: diagnosticsMode.log,
  });
  const {
    metrics: diagnosticsMetrics,
    recordPingSample: recordDiagnosticsPingSample,
    recordProjectionReconciliation,
    recordSnapshot: recordDiagnosticsSnapshot,
    recordTransportStatus: recordDiagnosticsTransportStatus,
  } = diagnostics;
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [displayNameInput, setDisplayNameInput] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinIntent, setJoinIntent] = useState<"play" | "watch" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(
    normalizedRoomCode === null ? "Room code is not supported." : null,
  );
  const [membershipEndedMessage, setMembershipEndedMessage] = useState<
    string | null
  >(null);
  const [membershipEndedReason, setMembershipEndedReason] = useState<
    MultiplayerRoomMembershipEnded["reason"] | null
  >(null);
  const [hostAnnouncement, setHostAnnouncement] = useState<string | null>(null);
  const [roomTransitionAnnouncement, setRoomTransitionAnnouncement] =
    useState<MultiplayerRoomTransitionAnnouncementState>(
      INITIAL_MULTIPLAYER_ROOM_TRANSITION_ANNOUNCEMENT,
    );
  const [leaveConfirmationOpen, setLeaveConfirmationOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [participantCapability, setParticipantCapability] = useState<
    string | null
  >(initialParticipantCapability);
  const [participantId, setParticipantId] = useState<string | null>(initialParticipantId);
  const [roomSnapshot, setRoomSnapshot] = useState<MultiplayerRoomClientSnapshot | null>(() =>
    initialRoom === null
      ? null
      : {
          ...(initialGame === null ? {} : { game: initialGame }),
          room: initialRoom,
          seq: initialSeq,
        },
  );
  const roomSnapshotRef = useRef(roomSnapshot);
  const focusMembershipActionAfterCommandRef = useRef(false);
  const focusRoomGameAfterReplacementRef = useRef(false);
  const focusedRoomElementBeforeSnapshotRef = useRef<Element | null>(null);
  const membershipEndedHeadingRef = useRef<HTMLHeadingElement>(null);
  const membershipActionButtonRef = useRef<HTMLButtonElement>(null);
  const roomContentRef = useRef<HTMLDivElement>(null);
  const roomGameHeadingRef = useRef<HTMLHeadingElement>(null);
  const roomHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousHostParticipantIdRef = useRef(
    initialRoom?.hostParticipantId ?? null,
  );
  const previousRoomTransitionRef = useRef<MultiplayerRoomTransitionState | null>(
    initialRoom === null ? null : getMultiplayerRoomTransitionState(initialRoom),
  );
  const room = roomSnapshot?.room ?? null;
  const game = roomSnapshot?.game;
  const displayName = displayNameInput ?? user?.displayName ?? "";
  const inviteLink = getPrivateRoomShareLink(normalizedRoomCode, browserOrigin);

  useEffect(() => {
    if (!focusHeadingOnMount) {
      return;
    }

    queueMicrotask(() => roomHeadingRef.current?.focus());
  }, [focusHeadingOnMount]);
  const participantFromLocalId = getParticipantById(room, participantId);
  const activeParticipant = participantFromLocalId;
  const activeParticipantId = participantFromLocalId?.id ?? null;
  const isHost =
    room !== null &&
    activeParticipant !== null &&
    activeParticipant.id === room.hostParticipantId &&
    activeParticipant.userId !== null &&
    activeParticipant.userId === userId;
  const watcherCount =
    room === null ? 0 : getPrivateRoomWatchingParticipantIds(room).length;
  const watcherLimitReached =
    room !== null && watcherCount >= room.observerLimit;
  const joinGameWouldWatch =
    room !== null && getPrivateRoomGuestPlayerAdmissionRole(room) === "observer";
  const hasOpenPlayerSeat =
    room?.seats.some((seat) => seat.occupiedByParticipantId === null) ?? false;
  const watcherLimitMessage = !watcherLimitReached
    ? null
    : !joinGameWouldWatch
      ? "Watching is full, but you can join the open player slot."
      : hasOpenPlayerSeat && (room?.nextMatchParticipantIds.length ?? 0) > 0
        ? "Watching is full and the open slot is reserved for the next player in line."
        : hasOpenPlayerSeat
          ? "Watching is full. The open player slot becomes available between matches."
          : "Watching is full and there are no open player slots.";
  const activeSeat =
    room?.seats.find(
      (seat) => seat.occupiedByParticipantId === activeParticipantId,
    ) ?? null;
  const leaveNeedsConfirmation =
    isHost ||
    (activeSeat !== null &&
      (room?.status === "running" || room?.status === "paused"));
  const applyRoomSnapshot = useCallback((nextSnapshot: MultiplayerRoomClientSnapshot) => {
    const currentSnapshot = roomSnapshotRef.current;
    const selectedSnapshot = selectFreshMultiplayerRoomSnapshot(
      currentSnapshot,
      nextSnapshot,
    );

    if (selectedSnapshot !== currentSnapshot) {
      const activeElement =
        typeof document === "undefined" ? null : document.activeElement;

      focusedRoomElementBeforeSnapshotRef.current =
        activeElement !== null &&
        roomContentRef.current?.contains(activeElement) === true
          ? activeElement
          : null;

      roomSnapshotRef.current = selectedSnapshot;
      setRoomSnapshot(selectedSnapshot);
    }

    return selectedSnapshot;
  }, [setRoomSnapshot]);
  const handleRoomClientSnapshot = useCallback(
    (
      nextSnapshot: MultiplayerRoomClientSnapshot,
      source: "http" | "websocket",
    ) => {
      if (source === "websocket") {
        recordDiagnosticsSnapshot(nextSnapshot);
        setLoadError(null);
      }

      return applyRoomSnapshot(nextSnapshot);
    },
    [applyRoomSnapshot, recordDiagnosticsSnapshot, setLoadError],
  );
  const handleRoomTransportConnectionError = useCallback(
    (error: Error) => {
      const { abandonRoom, message } =
        getMultiplayerRoomConnectionErrorState(error);

      if (abandonRoom) {
        roomSnapshotRef.current = null;
        setRoomSnapshot(null);
        setParticipantId(null);
        setParticipantCapability(null);
        if (normalizedRoomCode !== null) {
          removeMultiplayerRoomParticipantCredentials(normalizedRoomCode);
        }
      } else if (
        error instanceof MultiplayerRoomTransportError &&
        error.code === "participant-unauthorized"
      ) {
        setParticipantId(null);
        setParticipantCapability(null);
        if (normalizedRoomCode !== null) {
          removeMultiplayerRoomParticipantCredentials(normalizedRoomCode);
        }
      }

      setLoadError(message);
    },
    [
      normalizedRoomCode,
      setLoadError,
      setParticipantCapability,
      setParticipantId,
      setRoomSnapshot,
    ],
  );
  const handleMembershipEnded = useCallback(
    (event: MultiplayerRoomMembershipEnded) => {
      roomSnapshotRef.current = null;
      setRoomSnapshot(null);
      setParticipantId(null);
      setParticipantCapability(null);
      setPendingAction(null);
      setLeaveConfirmationOpen(false);
      setLoadError(null);
      setMembershipEndedReason(event.reason);
      setMembershipEndedMessage(
        event.reason === "party-closed"
          ? event.message
          : MULTIPLAYER_PARTY_LEFT_MESSAGE,
      );

      if (normalizedRoomCode !== null) {
        removeMultiplayerRoomParticipantCredentials(normalizedRoomCode);
      }
    },
    [
      normalizedRoomCode,
      setLeaveConfirmationOpen,
      setLoadError,
      setMembershipEndedMessage,
      setMembershipEndedReason,
      setParticipantCapability,
      setParticipantId,
      setPendingAction,
      setRoomSnapshot,
    ],
  );
  const transportLastSeq = useMemo(
    () => ({
      ...(roomSnapshot?.game?.seq === undefined
        ? {}
        : {
            game: {
              matchId: roomSnapshot.game.matchId,
              seq: roomSnapshot.game.seq,
            },
          }),
      ...(roomSnapshot?.seq === undefined ? {} : { room: roomSnapshot.seq }),
    }),
    [roomSnapshot],
  );
  const roomClient = useMultiplayerRoomClient({
    diagnosticsEnabled: diagnosticsMode.enabled,
    displayName,
    enabled:
      normalizedRoomCode !== null && membershipEndedMessage === null,
    lastSeq: transportLastSeq,
    onConnectionError: handleRoomTransportConnectionError,
    onDiagnosticsPingSample: recordDiagnosticsPingSample,
    onMembershipEnded: handleMembershipEnded,
    onParticipantCapability: setParticipantCapability,
    onParticipantId: setParticipantId,
    onSnapshot: handleRoomClientSnapshot,
    participantCapability,
    participantId: activeParticipantId ?? participantId,
    roomCode: normalizedRoomCode,
  });
  const {
    sendMessage: sendRoomClientMessage,
    status: roomClientStatus,
  } = roomClient;
  const roomActionsDisabled = roomClientStatus !== "active";
  const roomConnectionMessage = !roomActionsDisabled
    ? null
    : roomClientStatus === "unconfigured"
      ? "Preparing the live party connection."
      : getMultiplayerRoomStreamUnavailableMessage(roomClientStatus);

  useEffect(() => {
    recordDiagnosticsTransportStatus(roomClientStatus);
  }, [recordDiagnosticsTransportStatus, roomClientStatus]);

  useEffect(() => {
    if (membershipEndedMessage !== null) {
      membershipEndedHeadingRef.current?.focus();
    }
  }, [membershipEndedMessage]);

  useEffect(() => {
    if (room === null) {
      return;
    }

    const previousHostParticipantId = previousHostParticipantIdRef.current;

    if (
      previousHostParticipantId !== null &&
      previousHostParticipantId !== room.hostParticipantId
    ) {
      const nextHost = room.participants.find(
        (participant) => participant.id === room.hostParticipantId,
      );

      setHostAnnouncement(
        room.hostParticipantId === activeParticipantId
          ? "You’re now the party host."
          : `${nextHost?.displayName ?? "Another player"} is now the party host.`,
      );
    }

    previousHostParticipantIdRef.current = room.hostParticipantId;
  }, [activeParticipantId, room]);

  useEffect(() => {
    if (room === null) {
      previousRoomTransitionRef.current = null;
      return;
    }

    const nextTransition = getMultiplayerRoomTransitionState(room);
    const previousTransition = previousRoomTransitionRef.current;

    if (previousTransition !== null) {
      const announcement = getMultiplayerRoomTransitionAnnouncement(
        previousTransition,
        nextTransition,
      );

      if (announcement !== null) {
        setRoomTransitionAnnouncement((current) =>
          advanceMultiplayerRoomTransitionAnnouncement(current, announcement),
        );
      }
    }

    previousRoomTransitionRef.current = nextTransition;
  }, [room]);

  useEffect(() => {
    if (
      !focusMembershipActionAfterCommandRef.current ||
      pendingAction !== null
    ) {
      return;
    }

    // Membership commands can replace the initiating button with its inverse.
    focusMembershipActionAfterCommandRef.current = false;
    membershipActionButtonRef.current?.focus();
  }, [pendingAction, room]);

  useEffect(() => {
    const previouslyFocusedElement = focusedRoomElementBeforeSnapshotRef.current;

    if (previouslyFocusedElement === null) {
      return;
    }

    focusedRoomElementBeforeSnapshotRef.current = null;

    if (!previouslyFocusedElement.isConnected) {
      roomHeadingRef.current?.focus();
    }
  }, [roomSnapshot]);

  useEffect(() => {
    if (
      !focusRoomGameAfterReplacementRef.current ||
      pendingAction !== null ||
      roomGameHeadingRef.current === null
    ) {
      return;
    }

    focusRoomGameAfterReplacementRef.current = false;
    roomGameHeadingRef.current.focus();
  }, [pendingAction, room]);

  const handleCopyInviteLink = useCallback(() => {
    const currentInviteLink = getPrivateRoomShareLink(
      normalizedRoomCode,
      getBrowserOrigin() ?? browserOrigin,
    );

    if (typeof navigator === "undefined" || navigator.clipboard === undefined) {
      setCopyStatus("Invite link ready");
      return;
    }

    navigator.clipboard
      .writeText(currentInviteLink)
      .then(() => {
        setCopyStatus("Invite link copied");
      })
      .catch(() => {
        setCopyStatus("Invite link ready");
      });
  }, [browserOrigin, normalizedRoomCode, setCopyStatus]);

  const joinRoom = useCallback(
    async (type: "room.joinObserver" | "room.joinPlayer") => {
      if (normalizedRoomCode === null || isJoining) {
        return;
      }

      const normalizedDisplayName = normalizePrivateRoomDisplayName(displayName);

      if (normalizedDisplayName.length === 0) {
        setFormError("Display name is required.");
        return;
      }

      setIsJoining(true);
      setFormError(null);

      try {
        const result = await sendRoomClientMessage({
          displayName: normalizedDisplayName,
          type,
        });

        if (
          result.participantId === undefined ||
          result.participantCapability === undefined
        ) {
          throw new MultiplayerRoomRequestError(
            "Join room response did not include participant credentials.",
            200,
          );
        }

        setParticipantCapability(result.participantCapability);
        setParticipantId(result.participantId);
        setJoinIntent(type === "room.joinPlayer" ? "play" : "watch");
        writeMultiplayerRoomParticipantCredentials(normalizedRoomCode, {
          participantCapability: result.participantCapability,
          participantId: result.participantId,
          userId,
        });
      } catch (error) {
        setFormError(getMultiplayerRoomRequestErrorMessage(error));
      } finally {
        setIsJoining(false);
      }
    },
    [
      displayName,
      isJoining,
      normalizedRoomCode,
      sendRoomClientMessage,
      setFormError,
      setIsJoining,
      setParticipantCapability,
      setParticipantId,
      setJoinIntent,
      userId,
    ],
  );

  const handleJoinRoom = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void joinRoom("room.joinPlayer");
    },
    [joinRoom],
  );

  const handleWatchRoom = useCallback(() => {
    void joinRoom("room.joinObserver");
  }, [joinRoom]);

  async function handleSeatCommand(
    type: "room.claimSeat" | "room.releaseSeat",
    seatId: string,
  ) {
    if (
      normalizedRoomCode === null ||
      activeParticipantId === null ||
      room === null
    ) {
      setFormError("Join room first.");
      return;
    }

    const actionKey = `${type}:${seatId}`;

    setPendingAction(actionKey);
    setFormError(null);

    try {
      await sendRoomClientMessage({
        matchId: room.matchId,
        participantId: activeParticipantId,
        seatId,
        type,
      });
      focusMembershipActionAfterCommandRef.current = true;
    } catch (error) {
      setFormError(getMultiplayerRoomRequestErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  function handleClaimSeat(seatId: string) {
    void handleSeatCommand("room.claimSeat", seatId);
  }

  function handleReleaseSeat(seatId: string) {
    void handleSeatCommand("room.releaseSeat", seatId);
  }

  async function handleNextMatchCommand(
    type: "room.cancelNextMatch" | "room.joinNextMatch",
  ) {
    if (activeParticipantId === null || room === null) {
      setFormError("Join room first.");
      return;
    }

    setPendingAction(type);
    setFormError(null);

    try {
      await sendRoomClientMessage({
        matchId: room.matchId,
        participantId: activeParticipantId,
        type,
      });
      focusMembershipActionAfterCommandRef.current = true;
    } catch (error) {
      setFormError(getMultiplayerRoomRequestErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  function handleJoinNextMatch() {
    void handleNextMatchCommand("room.joinNextMatch");
  }

  function handleCancelNextMatch() {
    void handleNextMatchCommand("room.cancelNextMatch");
  }

  async function leaveParty() {
    if (activeParticipantId === null || room === null) {
      return;
    }

    setPendingAction("room.leave");
    setFormError(null);

    try {
      await sendRoomClientMessage({
        participantId: activeParticipantId,
        type: "room.leave",
      });
    } catch (error) {
      setFormError(getMultiplayerRoomRequestErrorMessage(error));
      setPendingAction(null);
    }
  }

  function requestLeaveParty() {
    if (leaveNeedsConfirmation) {
      setLeaveConfirmationOpen(true);
      return;
    }

    void leaveParty();
  }

  function confirmLeaveParty() {
    setLeaveConfirmationOpen(false);
    void leaveParty();
  }

  async function handleLifecycleCommand(command: PrivateRoomLifecycleCommand) {
    if (
      normalizedRoomCode === null ||
      activeParticipantId === null ||
      !isHost ||
      room === null
    ) {
      return;
    }

    const actionKey = `room.lifecycle:${command}`;

    setPendingAction(actionKey);
    setFormError(null);

    try {
      await sendRoomClientMessage({
        command,
        matchId: room.matchId,
        participantId: activeParticipantId,
        type: "room.lifecycle",
      });
      queueMicrotask(() => roomHeadingRef.current?.focus());
    } catch (error) {
      setFormError(getMultiplayerRoomRequestErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReplaceMatch(gameId: MultiplayerGameId) {
    if (
      normalizedRoomCode === null ||
      activeParticipantId === null ||
      !isHost ||
      room === null
    ) {
      return;
    }

    const actionKey = "room.replaceMatch";

    setPendingAction(actionKey);
    setFormError(null);

    try {
      await sendRoomClientMessage({
        matchId: room.matchId,
        participantId: activeParticipantId,
        settings: { gameId },
        type: "room.replaceMatch",
      });
      focusRoomGameAfterReplacementRef.current = true;
    } catch (error) {
      setFormError(getMultiplayerRoomRequestErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleGameInput<
    Game extends GameId = GameId,
    Input = MultiplayerGameInputPayload<Game>,
  >(gameId: Game, input: Input) {
    if (
      normalizedRoomCode === null ||
      activeParticipantId === null ||
      room === null
    ) {
      return;
    }

    try {
      await sendRoomClientMessage({
        gameId,
        input,
        matchId: room.matchId,
        participantId: activeParticipantId,
        type: "game.input",
      });
    } catch (error) {
      if (
        error instanceof MultiplayerRoomTransportError &&
        error.code === "stale-match"
      ) {
        return;
      }

      setFormError(getMultiplayerRoomRequestErrorMessage(error));
    }
  }
  const activeRoomGameRenderer =
    room !== null && room.status !== "lobby"
      ? getMultiplayerRoomGameRenderer(room, game)
      : null;
  const activeRoomGame =
    room !== null &&
    game !== null &&
    game !== undefined &&
    activeRoomGameRenderer !== null ? (
      <MultiplayerRoomGameRendererView
        key={`${game.gameId}:${game.matchId}`}
        activeParticipant={activeParticipant}
        game={game}
        lifecycleControls={
          isHost ? (
            <HostLifecycleControls
              gameId={room.settings.gameId}
              key={`${room.matchId}:${room.settings.gameId}`}
              onLifecycleCommand={handleLifecycleCommand}
              onReplaceMatch={handleReplaceMatch}
              pendingAction={pendingAction}
              status={room.status}
            />
          ) : null
        }
        renderer={activeRoomGameRenderer}
        room={room}
        onProjectionReconcile={recordProjectionReconciliation}
        sendGameInput={handleGameInput}
      />
    ) : null;
  const joinOutcomeMessage =
    initialJoinOutcomeMessage ??
    (activeParticipant === null || activeSeat !== null || joinIntent === null
      ? null
      : joinIntent === "play" && activeParticipant.role === "observer"
        ? "The game is active or full, so you joined as a watcher."
        : joinIntent === "watch"
          ? "You joined as a watcher."
          : null);

  return (
    <main
      className="min-h-svh bg-[var(--chrome-page)] px-4 py-6 text-[var(--chrome-ink)] sm:px-6 lg:py-8"
      data-testid="multiplayer-room-lobby"
    >
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              aria-label="Back to library"
              data-testid="multiplayer-room-back-button"
              onClick={onBackToLibrary}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <ArrowLeftIcon aria-hidden="true" />
            </Button>
            <div className="min-w-0">
              <h1
                className="rounded-sm text-3xl font-semibold tracking-normal text-[var(--chrome-ink)] outline-none focus:ring-3 focus:ring-[var(--chrome-focus-ring)]"
                data-testid="multiplayer-room-heading"
                ref={roomHeadingRef}
                tabIndex={-1}
              >
                Private Party
              </h1>
              <p
                className="mt-1 truncate text-sm font-medium text-[var(--chrome-muted)]"
                data-testid="multiplayer-room-code"
              >
                {normalizedRoomCode ?? initialRoomCode}
              </p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
            {socialCenterTrigger}
            <ThemeToggle testId="multiplayer-room-theme-toggle" />
            <UserAccountControls initialAuthMode={initialAuthMode} />
          </div>
        </header>

        {loadError !== null ? (
          <RoomMessage
            message={loadError}
            testId="multiplayer-room-error"
            tone="error"
          />
        ) : null}

        {room !== null && roomConnectionMessage !== null ? (
          <RoomMessage
            id={MULTIPLAYER_ROOM_CONNECTION_STATUS_ID}
            message={roomConnectionMessage}
            testId="multiplayer-room-connection-status"
            tone="muted"
          />
        ) : null}

        {membershipEndedMessage !== null ? (
          <section
            aria-labelledby="multiplayer-room-membership-ended-title"
            className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm"
            data-testid="multiplayer-room-membership-ended"
            role="status"
          >
            <h2
              className="text-xl font-semibold tracking-normal outline-none"
              id="multiplayer-room-membership-ended-title"
              ref={membershipEndedHeadingRef}
              tabIndex={-1}
            >
              {membershipEndedReason === "party-closed"
                ? "Party closed"
                : "You left"}
            </h2>
            <p className="mt-2 text-sm font-semibold text-[var(--chrome-muted)]">
              {membershipEndedMessage}
            </p>
            <Button
              className="mt-4 min-h-11 w-full sm:w-auto"
              data-testid="multiplayer-room-membership-ended-back-button"
              onClick={onBackToLibrary}
              size="lg"
              type="button"
            >
              Back to library
            </Button>
          </section>
        ) : null}

        <p aria-atomic="true" className="sr-only" role="status">
          {hostAnnouncement}
        </p>

        <div
          className="sr-only"
          data-testid="multiplayer-room-transition-announcement"
        >
          <p aria-atomic="true" role="status">
            {roomTransitionAnnouncement.activeSlot === 0
              ? roomTransitionAnnouncement.message
              : null}
          </p>
          <p aria-atomic="true" role="status">
            {roomTransitionAnnouncement.activeSlot === 1
              ? roomTransitionAnnouncement.message
              : null}
          </p>
        </div>

        {room === null &&
        loadError === null &&
        membershipEndedMessage === null ? (
          <RoomMessage
            message="Loading room"
            testId="multiplayer-room-loading"
            tone="muted"
          />
        ) : null}

        {activeRoomGame !== null && room !== null ? (
          <>
            <div
              className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start"
              ref={roomContentRef}
            >
              <div className="min-w-0">{activeRoomGame}</div>
              <aside
                className="flex flex-col gap-4"
                data-testid="multiplayer-room-active-party-panel"
              >
                {activeParticipant === null ? (
                  <section className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm">
                    <GuestJoinForm
                      connectionDescriptionId={
                        roomActionsDisabled
                          ? MULTIPLAYER_ROOM_CONNECTION_STATUS_ID
                          : undefined
                      }
                      displayName={displayName}
                      error={formError}
                      isJoining={isJoining}
                      joinGameDisabled={
                        isJoining ||
                        roomActionsDisabled ||
                        (joinGameWouldWatch && watcherLimitReached)
                      }
                      onDisplayNameChange={setDisplayNameInput}
                      onJoinGame={handleJoinRoom}
                      onWatch={handleWatchRoom}
                      watchDisabled={
                        isJoining || roomActionsDisabled || watcherLimitReached
                      }
                      watcherLimitMessage={watcherLimitMessage}
                    />
                  </section>
                ) : null}

                <MultiplayerPartyPanel
                  activeParticipantId={activeParticipantId}
                  actionsDisabled={roomActionsDisabled}
                  actionsDisabledDescriptionId={
                    roomActionsDisabled
                      ? MULTIPLAYER_ROOM_CONNECTION_STATUS_ID
                      : undefined
                  }
                  membershipActionButtonRef={membershipActionButtonRef}
                  onCancelNextMatch={handleCancelNextMatch}
                  onJoinGame={handleClaimSeat}
                  onJoinNextMatch={handleJoinNextMatch}
                  onLeaveParty={requestLeaveParty}
                  onWatchInstead={handleReleaseSeat}
                  pendingAction={pendingAction}
                  room={room}
                />

                {isHost && SocialPartyInviteControlsView !== undefined ? (
                  <SocialPartyInviteControlsView
                    actionsDisabled={roomActionsDisabled}
                    actionsDisabledDescriptionId={
                      roomActionsDisabled
                        ? MULTIPLAYER_ROOM_CONNECTION_STATUS_ID
                        : undefined
                    }
                    room={room}
                  />
                ) : null}

                <section className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm">
                  <Button
                    className="w-full"
                    data-testid="multiplayer-room-active-copy-invite-button"
                    onClick={handleCopyInviteLink}
                    type="button"
                    variant="outline"
                  >
                    <CopyIcon data-icon="inline-start" />
                    Copy invite link
                  </Button>
                  {copyStatus !== null ? (
                    <p
                      className="mt-2 text-sm font-medium text-[var(--chrome-muted)]"
                      role="status"
                    >
                      {copyStatus}
                    </p>
                  ) : null}
                </section>
              </aside>
            </div>
            {joinOutcomeMessage !== null ? (
              <RoomMessage
                message={joinOutcomeMessage}
                testId="multiplayer-room-join-outcome"
                tone="muted"
              />
            ) : null}
            {formError !== null && activeParticipant !== null ? (
              <RoomMessage
                message={formError}
                testId="multiplayer-room-form-error"
                tone="error"
              />
            ) : null}
          </>
        ) : room !== null ? (
          <div
            className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.8fr)]"
            ref={roomContentRef}
          >
            <div className="flex min-w-0 flex-col gap-4">
              <RoomSummary
                copyStatus={copyStatus}
                gameHeadingRef={roomGameHeadingRef}
                inviteLink={inviteLink}
                onCopyInviteLink={handleCopyInviteLink}
                room={room}
              />

              {activeParticipant === null ? (
                <section className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm">
                  <GuestJoinForm
                    connectionDescriptionId={
                      roomActionsDisabled
                        ? MULTIPLAYER_ROOM_CONNECTION_STATUS_ID
                        : undefined
                    }
                    displayName={displayName}
                    error={formError}
                    isJoining={isJoining}
                    joinGameDisabled={
                      isJoining ||
                      roomActionsDisabled ||
                      (joinGameWouldWatch && watcherLimitReached)
                    }
                    onDisplayNameChange={setDisplayNameInput}
                    onJoinGame={handleJoinRoom}
                    onWatch={handleWatchRoom}
                    watchDisabled={
                      isJoining || roomActionsDisabled || watcherLimitReached
                    }
                    watcherLimitMessage={watcherLimitMessage}
                  />
                </section>
              ) : isHost ? (
                <section className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm">
                  <HostLifecycleControls
                    gameId={room.settings.gameId}
                    key={`${room.matchId}:${room.settings.gameId}`}
                    onLifecycleCommand={handleLifecycleCommand}
                    onReplaceMatch={handleReplaceMatch}
                    pendingAction={pendingAction}
                    status={room.status}
                  />
                </section>
              ) : null}

              {joinOutcomeMessage !== null ? (
                <RoomMessage
                  message={joinOutcomeMessage}
                  testId="multiplayer-room-join-outcome"
                  tone="muted"
                />
              ) : null}

              {formError !== null && activeParticipant !== null ? (
                <RoomMessage
                  message={formError}
                  testId="multiplayer-room-form-error"
                  tone="error"
                />
              ) : null}
            </div>

            <aside className="flex min-w-0 flex-col gap-4">
              {isHost && SocialPartyInviteControlsView !== undefined ? (
                <SocialPartyInviteControlsView
                  actionsDisabled={roomActionsDisabled}
                  actionsDisabledDescriptionId={
                    roomActionsDisabled
                      ? MULTIPLAYER_ROOM_CONNECTION_STATUS_ID
                      : undefined
                  }
                  room={room}
                />
              ) : null}
              <MultiplayerPartyPanel
                activeParticipantId={activeParticipantId}
                actionsDisabled={roomActionsDisabled}
                actionsDisabledDescriptionId={
                  roomActionsDisabled
                    ? MULTIPLAYER_ROOM_CONNECTION_STATUS_ID
                    : undefined
                }
                membershipActionButtonRef={membershipActionButtonRef}
                onCancelNextMatch={handleCancelNextMatch}
                onJoinGame={handleClaimSeat}
                onJoinNextMatch={handleJoinNextMatch}
                onLeaveParty={requestLeaveParty}
                onWatchInstead={handleReleaseSeat}
                pendingAction={pendingAction}
                room={room}
              />
            </aside>
          </div>
        ) : null}
      </section>
      {leaveConfirmationOpen && room !== null ? (
        <LeavePartyDialog
          description={
            isHost
              ? "If another connected signed-in member is available, they will become host. Otherwise this party will close for everyone."
              : "You will leave your player slot immediately. The current match will continue for the remaining party."
          }
          onCancel={() => setLeaveConfirmationOpen(false)}
          onConfirm={confirmLeaveParty}
        />
      ) : null}
      {diagnosticsMode.overlay ? (
        <MultiplayerRoomDiagnosticsOverlay metrics={diagnosticsMetrics} />
      ) : null}
    </main>
  );
}

function RoomMessage({
  id,
  message,
  testId,
  tone,
}: {
  id?: string;
  message: string;
  testId: string;
  tone: "error" | "muted";
}) {
  return (
    <section
      className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm"
      data-testid={testId}
      id={id}
      role={tone === "error" ? "alert" : "status"}
    >
      <p
        className={
          tone === "error"
            ? "text-sm font-semibold text-destructive"
            : "text-sm font-semibold text-[var(--chrome-muted)]"
        }
      >
        {message}
      </p>
    </section>
  );
}

function RoomSummary({
  copyStatus,
  gameHeadingRef,
  inviteLink,
  onCopyInviteLink,
  room,
}: RoomSummaryProps) {
  const parameterEntries = Object.entries(room.settings.parameters ?? {});

  return (
    <section className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className="rounded-sm text-2xl font-semibold tracking-normal outline-none focus:ring-3 focus:ring-[var(--chrome-focus-ring)]"
              data-testid="multiplayer-room-game"
              ref={gameHeadingRef}
              tabIndex={-1}
            >
              {formatGameCatalogLabel(room.settings.gameId)}
            </h2>
            <span
              className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-accent-faint)] px-2 py-1 text-xs font-semibold uppercase tracking-normal text-[var(--chrome-ink)]"
              data-testid="multiplayer-room-status"
            >
              {getStatusLabel(room.status)}
            </span>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="multiplayer-room-settings">
            <div className="rounded-md border border-[var(--chrome-border)] p-3">
              <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--chrome-muted)]">
                Invite
              </dt>
              <dd className="mt-1 break-all text-sm font-semibold">{inviteLink}</dd>
            </div>
            {parameterEntries.map(([key, value]) => (
              <div className="rounded-md border border-[var(--chrome-border)] p-3" key={key}>
                <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--chrome-muted)]">
                  {formatRoomSettingLabel(key)}
                </dt>
                <dd className="mt-1 text-sm font-semibold">
                  {formatRoomSettingValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <Button
            aria-label="Copy invite link"
            data-testid="multiplayer-room-copy-invite-button"
            onClick={onCopyInviteLink}
            type="button"
            variant="outline"
          >
            <CopyIcon data-icon="inline-start" />
            Copy
          </Button>
          {copyStatus !== null ? (
            <p
              className="text-sm font-medium text-[var(--chrome-muted)]"
              data-testid="multiplayer-room-copy-status"
              role="status"
            >
              {copyStatus}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function GuestJoinForm({
  connectionDescriptionId,
  displayName,
  error,
  isJoining,
  joinGameDisabled,
  onDisplayNameChange,
  onJoinGame,
  onWatch,
  watchDisabled,
  watcherLimitMessage,
}: GuestJoinFormProps) {
  const hasError = error !== null;
  const watcherLimitDescriptionId = useId();
  const actionDescriptionIds = [
    connectionDescriptionId,
    watcherLimitMessage === null ? undefined : watcherLimitDescriptionId,
  ]
    .filter((value): value is string => value !== undefined)
    .join(" ");

  return (
    <form
      className="flex flex-col gap-3"
      data-testid="multiplayer-room-join-form"
      onSubmit={onJoinGame}
    >
      <div className="flex items-center gap-2">
        <UsersIcon className="size-5 text-[var(--chrome-muted)]" aria-hidden="true" />
        <h2 className="text-lg font-semibold tracking-normal">Join Party</h2>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold" htmlFor="room-display-name">
          Display name
        </label>
        <input
          aria-describedby={hasError ? "room-display-name-error" : undefined}
          aria-invalid={hasError}
          autoComplete="nickname"
          className="h-10 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] px-3 text-sm font-semibold text-[var(--chrome-ink)] outline-none transition focus-visible:border-[var(--chrome-accent)] focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)]"
          data-testid="multiplayer-room-display-name-input"
          disabled={isJoining}
          id="room-display-name"
          maxLength={MAX_USER_DISPLAY_NAME_LENGTH}
          onChange={(event) => onDisplayNameChange(event.target.value)}
          value={displayName}
        />
      </div>
      {hasError ? (
        <p
          className="text-sm font-semibold text-destructive"
          data-testid="multiplayer-room-form-error"
          id="room-display-name-error"
          role="status"
        >
          {error}
        </p>
      ) : null}
      {watcherLimitMessage !== null ? (
        <p
          className="text-sm font-medium text-[var(--chrome-muted)]"
          data-testid="multiplayer-room-watcher-limit"
          id={watcherLimitDescriptionId}
        >
          {watcherLimitMessage}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          aria-describedby={actionDescriptionIds || undefined}
          className="min-h-11 w-full sm:w-auto"
          data-testid="multiplayer-room-join-button"
          disabled={joinGameDisabled}
          size="lg"
          type="submit"
        >
          <UserPlusIcon data-icon="inline-start" />
          {isJoining ? "Joining" : "Join game"}
        </Button>
        <Button
          aria-describedby={actionDescriptionIds || undefined}
          className="min-h-11 w-full sm:w-auto"
          data-testid="multiplayer-room-watch-button"
          disabled={watchDisabled}
          onClick={onWatch}
          size="lg"
          type="button"
          variant="outline"
        >
          Watch
        </Button>
      </div>
    </form>
  );
}

function LeavePartyDialog({
  description,
  onCancel,
  onConfirm,
}: {
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      open
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm" />
        <Dialog.Popup
          aria-describedby="leave-party-dialog-description"
          aria-labelledby="leave-party-dialog-title"
          className="fixed left-1/2 top-1/2 z-[60] flex w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 text-[var(--chrome-ink)] shadow-[0_24px_90px_var(--chrome-shadow-modal)] outline-none"
          data-testid="multiplayer-leave-party-dialog"
          initialFocus
          role="alertdialog"
        >
          <div className="flex flex-col gap-2">
            <Dialog.Title
              className="text-xl font-semibold tracking-normal"
              id="leave-party-dialog-title"
            >
              Leave party?
            </Dialog.Title>
            <Dialog.Description
              className="text-sm leading-6 text-[var(--chrome-muted)]"
              id="leave-party-dialog-description"
            >
              {description}
            </Dialog.Description>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] px-4 text-sm font-semibold text-[var(--chrome-ink)] shadow-sm transition hover:bg-[var(--chrome-accent-faint)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)]"
              data-testid="multiplayer-leave-party-cancel"
              type="button"
            >
              Stay
            </Dialog.Close>
            <Button
              className="min-h-11"
              data-testid="multiplayer-leave-party-confirm"
              onClick={onConfirm}
              type="button"
              variant="destructive"
            >
              Leave party
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function HostLifecycleControls({
  gameId,
  onLifecycleCommand,
  onReplaceMatch,
  pendingAction,
  status,
}: HostLifecycleControlsProps) {
  const initialGameId = isMultiplayerGameId(gameId)
    ? gameId
    : DEFAULT_MULTIPLAYER_GAME_ID;
  const nextGameSelectId = useId();
  const [selectedGameId, setSelectedGameId] = useState(initialGameId);
  const canReplaceMatch = status === "finished" || status === "lobby";

  return (
    <div className="flex flex-col gap-2" data-testid="multiplayer-room-host-controls">
      <h3 className="text-sm font-semibold uppercase tracking-normal text-[var(--chrome-muted)]">
        Host Controls
      </h3>
      <div className="flex flex-wrap gap-2">
        {getLifecycleActions(status).map(({ command, icon: Icon, label }) => {
          const actionKey = `room.lifecycle:${command}`;

          return (
            <Button
              data-testid={`multiplayer-room-${command}-button`}
              disabled={pendingAction !== null}
              key={command}
              onClick={() => onLifecycleCommand(command)}
              type="button"
              variant={command === "restart" ? "outline" : "default"}
            >
              <Icon data-icon="inline-start" />
              {pendingAction === actionKey ? `${label}...` : label}
            </Button>
          );
        })}
      </div>
      <div className="mt-1 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label
          className="flex flex-col gap-1 text-sm font-semibold"
          htmlFor={nextGameSelectId}
        >
          Next game
          <select
            className="h-10 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] px-3 text-sm font-semibold text-[var(--chrome-ink)] outline-none transition focus-visible:border-[var(--chrome-accent)] focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)]"
            data-testid="multiplayer-room-next-game-select"
            disabled={pendingAction !== null || !canReplaceMatch}
            id={nextGameSelectId}
            onChange={(event) => {
              if (isMultiplayerGameId(event.target.value)) {
                setSelectedGameId(event.target.value);
              }
            }}
            value={selectedGameId}
          >
            {MULTIPLAYER_GAME_IDS.map((nextGameId) => (
              <option key={nextGameId} value={nextGameId}>
                {formatGameCatalogLabel(nextGameId)}
              </option>
            ))}
          </select>
        </label>
        <Button
          data-testid="multiplayer-room-replace-match-button"
          disabled={pendingAction !== null || !canReplaceMatch}
          onClick={() => onReplaceMatch(selectedGameId)}
          type="button"
          variant="outline"
        >
          {pendingAction === "room.replaceMatch" ? "Choosing..." : "Choose game"}
        </Button>
      </div>
      {!canReplaceMatch ? (
        <p className="text-sm font-medium text-[var(--chrome-muted)]">
          Finish the current match before choosing another game.
        </p>
      ) : null}
    </div>
  );
}
