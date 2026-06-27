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
  MultiplayerRoomTransportError,
  type MultiplayerRoomTransportStatus,
  useMultiplayerRoomWebSocketTransport,
} from "@/components/multiplayer-room-transport";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { UserAccountControls } from "@/components/user-account-controls";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatGameCatalogLabel, type GameId } from "@/lib/game-catalog";
import {
  getPrivateRoomInvitePath,
  normalizePrivateRoomCode,
  normalizePrivateRoomDisplayName,
  type PrivateRoom,
  type PrivateRoomParticipant,
  type PrivateRoomSeat,
  type PrivateRoomSettings,
  type PrivateRoomStatus,
} from "@/lib/multiplayer/room";
import type {
  MultiplayerGameInputPayload,
  MultiplayerRoomGameSnapshot,
  MultiplayerRoomSnapshot,
  PrivateRoomClientMessage,
  PrivateRoomCommandMessage,
  PrivateRoomLifecycleCommand,
} from "@/lib/multiplayer/protocol";
import {
  MAX_USER_DISPLAY_NAME_LENGTH,
  type UserAuthMode,
} from "@/lib/user-profile";

export const MULTIPLAYER_ROOMS_API_PATH = "/api/multiplayer/rooms";

const MULTIPLAYER_ROOM_ABANDONED_MESSAGE =
  "Room connection lost. This room is no longer available, so the in-progress game cannot continue. Start or join a new room.";

type RoomFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type RoomApiPayload = {
  game?: MultiplayerRoomGameSnapshot;
  participantId?: string;
  room: PrivateRoom;
  seq: number;
};

type HostOnlyRoomCommandMessage = Extract<
  PrivateRoomCommandMessage,
  { type: "room.lifecycle" | "room.updateSettings" }
>;

type CreateMultiplayerRoomOptions = {
  fetcher?: RoomFetch;
  gameId: GameId;
  settings?: PrivateRoomSettings;
};

type MultiplayerRoomLobbyProps = {
  initialAuthMode?: UserAuthMode | null;
  initialGame?: MultiplayerRoomGameSnapshot | null;
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
  onJoin: (event: FormEvent<HTMLFormElement>) => void;
};

type HostLifecycleControlsProps = {
  onLifecycleCommand: (command: PrivateRoomLifecycleCommand) => void;
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

export class MultiplayerRoomRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MultiplayerRoomRequestError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDefaultFetcher(fetcher: RoomFetch | undefined) {
  return fetcher ?? fetch;
}

function getRoomApiPath(roomCode: string) {
  const normalizedRoomCode = normalizePrivateRoomCode(roomCode);

  if (normalizedRoomCode === null) {
    throw new MultiplayerRoomRequestError("Room code is not supported.", 400);
  }

  return `${MULTIPLAYER_ROOMS_API_PATH}/${encodeURIComponent(normalizedRoomCode)}`;
}

async function readRoomApiPayload(
  response: Response,
  context: string,
): Promise<RoomApiPayload> {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : `${context} failed with status ${response.status}.`;

    throw new MultiplayerRoomRequestError(message, response.status);
  }

  if (!isRecord(payload) || !isRecord(payload.room)) {
    throw new MultiplayerRoomRequestError(`${context} response did not include a room.`, response.status);
  }

  if (typeof payload.seq !== "number") {
    throw new MultiplayerRoomRequestError(
      `${context} response did not include a sequence.`,
      response.status,
    );
  }

  const participantId =
    isRecord(payload.participant) && typeof payload.participant.id === "string"
      ? payload.participant.id
      : undefined;
  const game = isRecord(payload.game)
    ? (payload.game as MultiplayerRoomGameSnapshot)
    : undefined;

  return participantId === undefined
    ? ({
        ...(game === undefined ? {} : { game }),
        room: payload.room as PrivateRoom,
        seq: payload.seq,
      } satisfies RoomApiPayload)
    : ({
        ...(game === undefined ? {} : { game }),
        participantId,
        room: payload.room as PrivateRoom,
        seq: payload.seq,
      } satisfies RoomApiPayload);
}

export async function createMultiplayerRoom({
  fetcher,
  gameId,
  settings,
}: CreateMultiplayerRoomOptions) {
  const response = await getDefaultFetcher(fetcher)(MULTIPLAYER_ROOMS_API_PATH, {
    body: JSON.stringify({ gameId, settings }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = await readRoomApiPayload(response, "Create room");

  if (payload.participantId === undefined) {
    throw new MultiplayerRoomRequestError(
      "Create room response did not include a participant.",
      response.status,
    );
  }

  return {
    ...(payload.game === undefined ? {} : { game: payload.game }),
    participantId: payload.participantId,
    room: payload.room,
    seq: payload.seq,
  };
}

export async function postMultiplayerRoomCommand(
  roomCode: string,
  message: HostOnlyRoomCommandMessage,
  fetcher?: RoomFetch,
) {
  const response = await getDefaultFetcher(fetcher)(getRoomApiPath(roomCode), {
    body: JSON.stringify(message),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return readRoomApiPayload(response, "Room command");
}

function getRequestErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Room request failed.";
}

export function getMultiplayerRoomConnectionErrorState(error: unknown) {
  const abandonRoom =
    error instanceof MultiplayerRoomTransportError &&
    error.code === "room-not-found";

  return {
    abandonRoom,
    message: abandonRoom
      ? MULTIPLAYER_ROOM_ABANDONED_MESSAGE
      : getRequestErrorMessage(error),
  };
}

function getParticipantById(room: PrivateRoom | null, participantId: string | null) {
  if (room === null || participantId === null) {
    return null;
  }

  return room.participants.find((participant) => participant.id === participantId) ?? null;
}

function getParticipantByUserId(room: PrivateRoom | null, userId: string | null) {
  if (room === null || userId === null) {
    return null;
  }

  return room.participants.find((participant) => participant.userId === userId) ?? null;
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

export function shouldPostMultiplayerRoomCommandOverHttp<
  Game extends GameId = GameId,
  Input = MultiplayerGameInputPayload<Game>,
>(
  message: PrivateRoomClientMessage<Game, Input>,
): message is HostOnlyRoomCommandMessage {
  return message.type === "room.lifecycle" || message.type === "room.updateSettings";
}

export function getMultiplayerRoomStreamUnavailableMessage(
  transportStatus: MultiplayerRoomTransportStatus,
) {
  if (transportStatus === "unconfigured") {
    return "Room stream is not configured. Live room commands require WebSockets.";
  }

  if (transportStatus === "unavailable") {
    return "Room stream is unavailable. Live room commands require WebSockets.";
  }

  if (transportStatus === "reconnecting") {
    return "Room stream is reconnecting. Try again once the WebSocket stream is ready.";
  }

  if (transportStatus === "connecting") {
    return "Room stream is connecting. Try again once the WebSocket stream is ready.";
  }

  return "Room stream is connected.";
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

  const currentGameSeq = current.game?.seq ?? -1;
  const nextGameSeq = next.game?.seq ?? -1;

  return nextGameSeq > currentGameSeq ? next : current;
}

export function MultiplayerRoomLobby({
  initialAuthMode = null,
  initialGame = null,
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
  const [loadError, setLoadError] = useState<string | null>(
    normalizedRoomCode === null ? "Room code is not supported." : null,
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(initialParticipantId);
  const [roomSnapshot, setRoomSnapshot] = useState<RoomApiPayload | null>(() =>
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
  const participantFromUser = getParticipantByUserId(room, userId);
  const activeParticipant = participantFromLocalId ?? participantFromUser;
  const activeParticipantId = participantFromLocalId?.id ?? participantFromUser?.id ?? null;
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
  const applyRoomSnapshot = useCallback((nextSnapshot: RoomApiPayload) => {
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
  const handleRoomTransportSnapshot = useCallback(
    (nextSnapshot: RoomApiPayload) => {
      recordDiagnosticsSnapshot(nextSnapshot);
      setLoadError(null);
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
      }

      setLoadError(message);
    },
    [setLoadError, setParticipantId, setRoomSnapshot],
  );
  const transportLastSeq = useMemo(
    () => ({
      ...(roomSnapshot?.game?.seq === undefined
        ? {}
        : { game: roomSnapshot.game.seq }),
      ...(roomSnapshot?.seq === undefined ? {} : { room: roomSnapshot.seq }),
    }),
    [roomSnapshot],
  );
  const roomTransport = useMultiplayerRoomWebSocketTransport({
    diagnosticsEnabled: diagnosticsMode.enabled,
    displayName,
    enabled: normalizedRoomCode !== null,
    lastSeq: transportLastSeq,
    onConnectionError: handleRoomTransportConnectionError,
    onDiagnosticsPingSample: recordDiagnosticsPingSample,
    onParticipantId: setParticipantId,
    onSnapshot: handleRoomTransportSnapshot,
    participantId: activeParticipantId ?? participantId,
    roomCode: normalizedRoomCode,
  });
  const {
    sendGameInput: sendRoomTransportGameInput,
    sendRoomCommand: sendRoomTransportCommand,
    status: roomTransportStatus,
  } = roomTransport;

  useEffect(() => {
    recordDiagnosticsTransportStatus(roomTransportStatus);
  }, [recordDiagnosticsTransportStatus, roomTransportStatus]);

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

  const sendRoomClientMessage = useCallback(
    async <Game extends GameId = GameId, Input = MultiplayerGameInputPayload<Game>>(
      message: PrivateRoomClientMessage<Game, Input>,
    ) => {
      if (normalizedRoomCode === null) {
        throw new MultiplayerRoomRequestError("Room code is not supported.", 400);
      }

      if (shouldPostMultiplayerRoomCommandOverHttp(message)) {
        const result = await postMultiplayerRoomCommand(normalizedRoomCode, message);

        if (result.participantId !== undefined) {
          setParticipantId(result.participantId);
        }

        applyRoomSnapshot(result);

        return result;
      }

      if (roomTransportStatus === "active") {
        const ack =
          message.type === "game.input"
            ? await sendRoomTransportGameInput(
                message.gameId,
                message.input,
                message.participantId,
              )
            : await sendRoomTransportCommand(message);

        if (ack.participantId !== undefined) {
          setParticipantId(ack.participantId);
        }

        return ack;
      }

      throw new MultiplayerRoomRequestError(
        getMultiplayerRoomStreamUnavailableMessage(roomTransportStatus),
        0,
      );
    },
    [
      applyRoomSnapshot,
      normalizedRoomCode,
      roomTransportStatus,
      sendRoomTransportGameInput,
      sendRoomTransportCommand,
      setParticipantId,
    ],
  );

  const handleJoinRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

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
          type: "room.joinObserver",
          userId,
        });

        if (result.participantId === undefined) {
          throw new MultiplayerRoomRequestError(
            "Join room response did not include a participant.",
            200,
          );
        }

        setParticipantId(result.participantId);
      } catch (error) {
        setFormError(getRequestErrorMessage(error));
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
      setParticipantId,
      userId,
    ],
  );

  async function handleSeatCommand(
    type: "room.claimSeat" | "room.releaseSeat",
    seatId: string,
  ) {
    if (normalizedRoomCode === null || activeParticipantId === null) {
      setFormError("Join room first.");
      return;
    }

    const actionKey = `${type}:${seatId}`;

    setPendingAction(actionKey);
    setFormError(null);

    try {
      await sendRoomClientMessage({
        participantId: activeParticipantId,
        seatId,
        type,
      });
    } catch (error) {
      setFormError(getRequestErrorMessage(error));
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
    if (normalizedRoomCode === null || activeParticipantId === null || !isHost) {
      return;
    }

    const actionKey = `room.lifecycle:${command}`;

    setPendingAction(actionKey);
    setFormError(null);

    try {
      await sendRoomClientMessage({
        command,
        participantId: activeParticipantId,
        type: "room.lifecycle",
      });
    } catch (error) {
      setFormError(getRequestErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleGameInput<
    Game extends GameId = GameId,
    Input = MultiplayerGameInputPayload<Game>,
  >(gameId: Game, input: Input) {
    if (normalizedRoomCode === null || activeParticipantId === null) {
      return;
    }

    try {
      await sendRoomClientMessage({
        gameId,
        input,
        participantId: activeParticipantId,
        type: "game.input",
      });
    } catch (error) {
      setFormError(getRequestErrorMessage(error));
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
        activeParticipant={activeParticipant}
        game={game}
        lifecycleControls={
          isHost ? (
            <HostLifecycleControls
              onLifecycleCommand={handleLifecycleCommand}
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
                Private Room
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
            {activeRoomGame}
            {formError !== null ? (
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
                  onJoin={handleJoinRoom}
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
                  </div>

                  {isHost ? (
                    <HostLifecycleControls
                      onLifecycleCommand={handleLifecycleCommand}
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
  onJoin,
}: GuestJoinFormProps) {
  const hasError = error !== null;

  return (
    <form className="flex flex-col gap-3" data-testid="multiplayer-room-join-form" onSubmit={onJoin}>
      <div className="flex items-center gap-2">
        <UsersIcon className="size-5 text-[var(--chrome-muted)]" aria-hidden="true" />
        <h2 className="text-lg font-semibold tracking-normal">Join Room</h2>
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
      <Button
        data-testid="multiplayer-room-join-button"
        disabled={disabled}
        size="lg"
        type="submit"
      >
        <UserPlusIcon data-icon="inline-start" />
        {disabled ? "Joining" : "Join"}
      </Button>
    </form>
  );
}

function HostLifecycleControls({
  onLifecycleCommand,
  pendingAction,
  status,
}: HostLifecycleControlsProps) {
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
