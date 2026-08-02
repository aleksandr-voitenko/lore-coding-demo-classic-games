"use client";

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
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

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
  getMultiplayerRoomRequestErrorMessage,
  type MultiplayerRoomClientSnapshot,
  useMultiplayerRoomClient,
} from "@/components/multiplayer-room-client";
import {
  removeMultiplayerRoomParticipantCredentials,
  writeMultiplayerRoomParticipantCredentials,
} from "@/components/multiplayer-room-participant-credentials";
import { MultiplayerRoomTransportError } from "@/components/multiplayer-room-transport";
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
  getPrivateRoomInvitePath,
  normalizePrivateRoomCode,
  normalizePrivateRoomDisplayName,
  type PrivateRoom,
  type PrivateRoomParticipant,
  type PrivateRoomSeat,
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

type MultiplayerRoomLobbyProps = {
  initialAuthMode?: UserAuthMode | null;
  initialGame?: MultiplayerRoomGameSnapshot | null;
  initialParticipantCapability?: string | null;
  initialParticipantId?: string | null;
  initialRoom?: PrivateRoom | null;
  initialSeq?: number;
  initialRoomCode: string;
  onBackToLibrary: () => void;
};

type GuestJoinFormProps = {
  displayName: string;
  disabled: boolean;
  error: string | null;
  onDisplayNameChange: (value: string) => void;
  onJoinGame: (event: FormEvent<HTMLFormElement>) => void;
  onWatch: () => void;
};

type HostLifecycleControlsProps = {
  gameId: GameId;
  onLifecycleCommand: (command: PrivateRoomLifecycleCommand) => void;
  onReplaceMatch: (gameId: MultiplayerGameId) => void;
  pendingAction: string | null;
  status: PrivateRoomStatus;
};

type RoomSeatsProps = {
  activeParticipantId: string | null;
  onClaimSeat: (seatId: string) => void;
  onReleaseSeat: (seatId: string) => void;
  participantsById: ReadonlyMap<string, PrivateRoomParticipant>;
  pendingAction: string | null;
  seats: PrivateRoomSeat[];
};

type RoomParticipantsProps = {
  hostParticipantId: string;
  participants: PrivateRoomParticipant[];
};

type RoomSummaryProps = {
  copyStatus: string | null;
  inviteLink: string;
  onCopyInviteLink: () => void;
  room: PrivateRoom;
};

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

function createParticipantsById(participants: PrivateRoomParticipant[]) {
  return new Map(participants.map((participant) => [participant.id, participant]));
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

function getParticipantRoleLabel(participant: PrivateRoomParticipant, hostParticipantId: string) {
  if (participant.id === hostParticipantId) {
    return "Host";
  }

  return participant.role === "player" ? "Player" : "Observer";
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
  initialAuthMode = null,
  initialGame = null,
  initialParticipantCapability = null,
  initialParticipantId = null,
  initialRoom = null,
  initialSeq = 0,
  initialRoomCode,
  onBackToLibrary,
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
  const room = roomSnapshot?.room ?? null;
  const game = roomSnapshot?.game;
  const displayName = displayNameInput ?? user?.displayName ?? "";
  const inviteLink = getPrivateRoomShareLink(normalizedRoomCode, browserOrigin);
  const participantFromLocalId = getParticipantById(room, participantId);
  const activeParticipant = participantFromLocalId;
  const activeParticipantId = participantFromLocalId?.id ?? null;
  const isHost =
    room !== null &&
    activeParticipant !== null &&
    activeParticipant.id === room.hostParticipantId &&
    activeParticipant.userId !== null &&
    activeParticipant.userId === userId;
  const participantsById = useMemo(
    () => createParticipantsById(room?.participants ?? []),
    [room?.participants],
  );
  const applyRoomSnapshot = useCallback((nextSnapshot: MultiplayerRoomClientSnapshot) => {
    const selectedSnapshot = selectFreshMultiplayerRoomSnapshot(
      roomSnapshotRef.current,
      nextSnapshot,
    );

    if (selectedSnapshot !== roomSnapshotRef.current) {
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
    enabled: normalizedRoomCode !== null,
    lastSeq: transportLastSeq,
    onConnectionError: handleRoomTransportConnectionError,
    onDiagnosticsPingSample: recordDiagnosticsPingSample,
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

  useEffect(() => {
    recordDiagnosticsTransportStatus(roomClientStatus);
  }, [recordDiagnosticsTransportStatus, roomClientStatus]);

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
    activeParticipant === null || joinIntent === null
      ? null
      : joinIntent === "play" && activeParticipant.role === "observer"
        ? "The game is active or full, so you joined as a watcher."
        : joinIntent === "watch"
          ? "You joined as a watcher."
          : null;

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
              <h1 className="text-3xl font-semibold tracking-normal text-[var(--chrome-ink)]">
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

        {room === null && loadError === null ? (
          <RoomMessage
            message="Loading room"
            testId="multiplayer-room-loading"
            tone="muted"
          />
        ) : null}

        {activeRoomGame !== null ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
              <div className="min-w-0">{activeRoomGame}</div>
              <aside
                className="flex flex-col gap-4 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm"
                data-testid="multiplayer-room-active-party-panel"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-normal">Party</h2>
                    <p className="mt-1 text-sm font-medium text-[var(--chrome-muted)]">
                      {room === null ? "" : formatGameCatalogLabel(room.settings.gameId)}
                    </p>
                  </div>
                  {room !== null ? (
                    <span className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-accent-faint)] px-2 py-1 text-xs font-semibold uppercase tracking-normal">
                      {getStatusLabel(room.status)}
                    </span>
                  ) : null}
                </div>

                {activeParticipant === null ? (
                  <GuestJoinForm
                    disabled={isJoining}
                    displayName={displayName}
                    error={formError}
                    onDisplayNameChange={setDisplayNameInput}
                    onJoinGame={handleJoinRoom}
                    onWatch={handleWatchRoom}
                  />
                ) : room !== null ? (
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-normal text-[var(--chrome-muted)]">
                      Your role
                    </h3>
                    <p
                      className="mt-1 font-semibold"
                      data-testid="multiplayer-room-current-participant"
                    >
                      {activeParticipant.displayName} ·{" "}
                      {getParticipantRoleLabel(
                        activeParticipant,
                        room.hostParticipantId,
                      )}
                    </p>
                    {joinOutcomeMessage !== null ? (
                      <p
                        className="mt-2 text-sm font-medium text-[var(--chrome-muted)]"
                        data-testid="multiplayer-room-join-outcome"
                        role="status"
                      >
                        {joinOutcomeMessage}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-normal text-[var(--chrome-muted)]">
                    Players and watchers
                  </h3>
                  <ul className="mt-2 grid gap-2">
                    {room?.participants.map((participant) => (
                      <li
                        className="flex items-center justify-between gap-2 rounded-md border border-[var(--chrome-border)] px-3 py-2"
                        key={participant.id}
                      >
                        <span className="min-w-0 truncate font-semibold">
                          {participant.displayName}
                        </span>
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-normal text-[var(--chrome-muted)]">
                          {getParticipantRoleLabel(
                            participant,
                            room.hostParticipantId,
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
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
                    className="text-sm font-medium text-[var(--chrome-muted)]"
                    role="status"
                  >
                    {copyStatus}
                  </p>
                ) : null}
              </aside>
            </div>
            {formError !== null && activeParticipant !== null ? (
              <RoomMessage
                message={formError}
                testId="multiplayer-room-form-error"
                tone="error"
              />
            ) : null}
          </>
        ) : room !== null ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.8fr)]">
            <RoomSummary
              copyStatus={copyStatus}
              inviteLink={inviteLink}
              onCopyInviteLink={handleCopyInviteLink}
              room={room}
            />

            <section className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm">
              {activeParticipant === null ? (
                <GuestJoinForm
                  disabled={isJoining}
                  displayName={displayName}
                  error={formError}
                  onDisplayNameChange={setDisplayNameInput}
                  onJoinGame={handleJoinRoom}
                  onWatch={handleWatchRoom}
                />
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-normal">Your Role</h2>
                    <p
                      className="mt-1 text-sm font-medium text-[var(--chrome-muted)]"
                      data-testid="multiplayer-room-current-participant"
                    >
                      {activeParticipant.displayName} ·{" "}
                      {getParticipantRoleLabel(activeParticipant, room.hostParticipantId)}
                    </p>
                    {joinOutcomeMessage !== null ? (
                      <p
                        className="mt-2 text-sm font-medium text-[var(--chrome-muted)]"
                        data-testid="multiplayer-room-join-outcome"
                        role="status"
                      >
                        {joinOutcomeMessage}
                      </p>
                    ) : null}
                  </div>

                  {isHost ? (
                    <HostLifecycleControls
                      gameId={room.settings.gameId}
                      key={`${room.matchId}:${room.settings.gameId}`}
                      onLifecycleCommand={handleLifecycleCommand}
                      onReplaceMatch={handleReplaceMatch}
                      pendingAction={pendingAction}
                      status={room.status}
                    />
                  ) : null}

                  {formError !== null ? (
                    <p
                      className="text-sm font-semibold text-destructive"
                      data-testid="multiplayer-room-form-error"
                      role="status"
                    >
                      {formError}
                    </p>
                  ) : null}
                </div>
              )}
            </section>

            <RoomSeats
              activeParticipantId={activeParticipantId}
              onClaimSeat={handleClaimSeat}
              onReleaseSeat={handleReleaseSeat}
              participantsById={participantsById}
              pendingAction={pendingAction}
              seats={room.seats}
            />

            <RoomParticipants
              hostParticipantId={room.hostParticipantId}
              participants={room.participants}
            />
          </div>
        ) : null}
      </section>
      {diagnosticsMode.overlay ? (
        <MultiplayerRoomDiagnosticsOverlay metrics={diagnosticsMetrics} />
      ) : null}
    </main>
  );
}

function RoomMessage({
  message,
  testId,
  tone,
}: {
  message: string;
  testId: string;
  tone: "error" | "muted";
}) {
  return (
    <section
      className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm"
      data-testid={testId}
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
              className="text-2xl font-semibold tracking-normal"
              data-testid="multiplayer-room-game"
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
  disabled,
  displayName,
  error,
  onDisplayNameChange,
  onJoinGame,
  onWatch,
}: GuestJoinFormProps) {
  const hasError = error !== null;

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
          disabled={disabled}
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
      <div className="flex flex-wrap gap-2">
        <Button
          data-testid="multiplayer-room-join-button"
          disabled={disabled}
          size="lg"
          type="submit"
        >
          <UserPlusIcon data-icon="inline-start" />
          {disabled ? "Joining" : "Join game"}
        </Button>
        <Button
          data-testid="multiplayer-room-watch-button"
          disabled={disabled}
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

function RoomSeats({
  activeParticipantId,
  onClaimSeat,
  onReleaseSeat,
  participantsById,
  pendingAction,
  seats,
}: RoomSeatsProps) {
  return (
    <section className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm">
      <h2 className="text-lg font-semibold tracking-normal">Seats</h2>
      <div className="mt-3 grid gap-2" data-testid="multiplayer-room-seats">
        {seats.map((seat) => {
          const occupant =
            seat.occupiedByParticipantId === null
              ? null
              : participantsById.get(seat.occupiedByParticipantId) ?? null;
          const isOccupiedByCurrentParticipant =
            activeParticipantId !== null &&
            seat.occupiedByParticipantId === activeParticipantId;
          const actionType = isOccupiedByCurrentParticipant
            ? "room.releaseSeat"
            : "room.claimSeat";
          const pendingSeatAction = pendingAction === `${actionType}:${seat.id}`;

          return (
            <div
              className="grid gap-3 rounded-md border border-[var(--chrome-border)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              data-testid={`multiplayer-room-seat-${seat.id}`}
              key={seat.id}
            >
              <div className="min-w-0">
                <p className="font-semibold">{seat.label}</p>
                <p className="mt-1 text-sm font-medium text-[var(--chrome-muted)]">
                  {occupant?.displayName ?? "Open"}
                  {seat.required ? " · Required" : ""}
                </p>
              </div>
              {isOccupiedByCurrentParticipant ? (
                <Button
                  data-testid={`multiplayer-room-release-seat-${seat.id}`}
                  disabled={pendingAction !== null}
                  onClick={() => onReleaseSeat(seat.id)}
                  type="button"
                  variant="outline"
                >
                  {pendingSeatAction ? "Releasing..." : "Release"}
                </Button>
              ) : (
                <Button
                  data-testid={`multiplayer-room-claim-seat-${seat.id}`}
                  disabled={
                    activeParticipantId === null ||
                    pendingAction !== null ||
                    seat.occupiedByParticipantId !== null
                  }
                  onClick={() => onClaimSeat(seat.id)}
                  type="button"
                  variant="outline"
                >
                  {pendingSeatAction ? "Claiming..." : "Claim"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RoomParticipants({
  hostParticipantId,
  participants,
}: RoomParticipantsProps) {
  return (
    <section className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm">
      <h2 className="text-lg font-semibold tracking-normal">Participants</h2>
      <ul className="mt-3 grid gap-2" data-testid="multiplayer-room-participants">
        {participants.map((participant) => (
          <li
            className="flex items-center justify-between gap-3 rounded-md border border-[var(--chrome-border)] p-3"
            data-testid={`multiplayer-room-participant-${participant.id}`}
            key={participant.id}
          >
            <span className="min-w-0 truncate font-semibold">
              {participant.displayName}
            </span>
            <span className="shrink-0 text-xs font-semibold uppercase tracking-normal text-[var(--chrome-muted)]">
              {getParticipantRoleLabel(participant, hostParticipantId)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
