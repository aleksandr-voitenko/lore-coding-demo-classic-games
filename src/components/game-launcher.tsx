"use client";

import { Gamepad2Icon, PlayIcon, TrophyIcon, UserIcon, UsersIcon } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  GAME_CARDS,
  GAME_PARAMETER_CONFIG,
  createDefaultParameterValues,
  createInitialGameProps,
  getVersionedGameArtworkSrc,
  type GameCard,
  type GameId,
  type GameParameterKind,
  type GameParameterValues,
} from "@/components/game-launcher-config";
import { GameCardArtworkFrame } from "@/components/game-card-artwork-frame";
import { PLAYABLE_GAME_COMPONENTS } from "@/components/game-launcher-playables";
import { GlobalLeaderboardScreen } from "@/components/global-leaderboard";
import { createMultiplayerRoom } from "@/components/multiplayer-room-client";
import { MultiplayerRoomLobby } from "@/components/multiplayer-room-lobby";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAccountControls } from "@/components/user-account-controls";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  MULTIPLAYER_GAME_IDS,
  isMultiplayerGameId,
} from "@/lib/multiplayer/game-registry";
import {
  getPrivateRoomInvitePath,
  normalizePrivateRoomCode,
  type PrivateRoom,
  type PrivateRoomSettings,
} from "@/lib/multiplayer/room";
import type { UserAuthMode } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

type MenuViewport = {
  scrollX: number;
  scrollY: number;
};

type GameLauncherProps = {
  initialAuthMode?: UserAuthMode | null;
  initialReplayGameId?: GameId | null;
  initialRoomCode?: string | null;
};

type ActiveRoomSession = {
  participantId: string | null;
  room: PrivateRoom | null;
  roomCode: string;
};

type PrivateRoomCreateRequest = {
  gameId: GameId;
  generation: number;
  userId: string;
};

type RoomParticipantCapability = {
  participantId: string;
  userId: string;
};

type GameCardAction = "host-room" | "play";

type GameLibraryTab = "single-player" | "multiplayer";

const GAME_LIBRARY_TAB_CONFIGS = [
  {
    count: GAME_CARDS.length,
    id: "single-player",
    label: "Single player",
  },
  {
    count: MULTIPLAYER_GAME_IDS.length,
    id: "multiplayer",
    label: "Multiplayer",
  },
] as const satisfies readonly {
  count: number;
  id: GameLibraryTab;
  label: string;
}[];

const MULTIPLAYER_GAME_CARDS = GAME_CARDS.filter((game) =>
  isMultiplayerGameId(game.id),
);

const MULTIPLAYER_STATUS_ID = "multiplayer-room-host-status";
const MULTIPLAYER_SIGN_IN_REQUIRED_MESSAGE =
  "Sign in before creating multiplayer rooms.";

export function GameLauncher({
  initialAuthMode = null,
  initialReplayGameId = null,
  initialRoomCode = null,
}: GameLauncherProps) {
  const { user } = useCurrentUser();
  const currentUserId = user?.id ?? null;
  const [activeRoomSession, setActiveRoomSession] = useState<ActiveRoomSession | null>(() =>
    initialRoomCode === null ? null : createUnloadedActiveRoomSession(initialRoomCode),
  );
  // Participant ids are capabilities, so only retain their creating account alongside them.
  const roomParticipantCapabilityHistoryRef = useRef<
    Map<string, RoomParticipantCapability>
  >(new Map());
  const roomCreateRequestGenerationRef = useRef(0);
  const [selectedGameId, setSelectedGameId] = useState<GameId | null>(initialReplayGameId);
  const [selectedReplayMode, setSelectedReplayMode] = useState<"latest" | null>(
    initialReplayGameId === null ? null : "latest",
  );
  const [activeGameLibraryTab, setActiveGameLibraryTab] =
    useState<GameLibraryTab>("single-player");
  const [isGlobalLeaderboardVisible, setIsGlobalLeaderboardVisible] = useState(false);
  const [parameterValues, setParameterValues] = useState<GameParameterValues>(() =>
    createDefaultParameterValues(),
  );
  const [privateRoomCreateError, setPrivateRoomCreateError] = useState<string | null>(null);
  const [privateRoomCreateRequest, setPrivateRoomCreateRequest] =
    useState<PrivateRoomCreateRequest | null>(null);
  // Return-to-menu paths opt into restoring this viewport after a full-screen game view exits.
  const menuViewportRef = useRef<MenuViewport>({ scrollX: 0, scrollY: 0 });
  const shouldRestoreMenuViewportRef = useRef(false);

  const selectedGame = GAME_CARDS.find((game) => game.id === selectedGameId) ?? null;
  const activeGameCards =
    activeGameLibraryTab === "multiplayer" ? MULTIPLAYER_GAME_CARDS : GAME_CARDS;
  const privateRoomCreatingGameId =
    privateRoomCreateRequest?.userId === currentUserId
      ? privateRoomCreateRequest.gameId
      : null;
  const privateRoomCreatingGame =
    privateRoomCreatingGameId === null
      ? null
      : GAME_CARDS.find((game) => game.id === privateRoomCreatingGameId) ?? null;
  const displayedPrivateRoomCreateError =
    user !== null && privateRoomCreateError === MULTIPLAYER_SIGN_IN_REQUIRED_MESSAGE
      ? null
      : privateRoomCreateError;
  const multiplayerStatusMessage =
    activeGameLibraryTab !== "multiplayer"
      ? null
      : displayedPrivateRoomCreateError ??
        (privateRoomCreatingGame === null
          ? user === null
            ? MULTIPLAYER_SIGN_IN_REQUIRED_MESSAGE
            : null
          : `Creating ${privateRoomCreatingGame.label} room`);

  useEffect(() => {
    for (const [roomCode, capability] of roomParticipantCapabilityHistoryRef.current) {
      if (capability.userId !== currentUserId) {
        roomParticipantCapabilityHistoryRef.current.delete(roomCode);
      }
    }

    function handlePopState() {
      roomCreateRequestGenerationRef.current += 1;
      const roomCode = getLauncherPrivateRoomCodeFromSearch(window.location.search);

      setActiveRoomSession(() => {
        if (roomCode === null) {
          return null;
        }

        const capability = roomParticipantCapabilityHistoryRef.current.get(roomCode);

        if (capability !== undefined && capability.userId !== currentUserId) {
          roomParticipantCapabilityHistoryRef.current.delete(roomCode);
        }

        return createUnloadedActiveRoomSession(
          roomCode,
          capability?.userId === currentUserId ? capability.participantId : null,
        );
      });
      setPrivateRoomCreateError(null);
      setPrivateRoomCreateRequest(null);
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      roomCreateRequestGenerationRef.current += 1;
      window.removeEventListener("popstate", handlePopState);
    };
  }, [currentUserId]);

  const selectGame = useCallback((gameId: GameId) => {
    menuViewportRef.current = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
    shouldRestoreMenuViewportRef.current = false;

    setSelectedGameId(gameId);
    setSelectedReplayMode(null);
  }, []);

  const switchGameLibraryTab = useCallback((tab: GameLibraryTab) => {
    setActiveGameLibraryTab(tab);
    setPrivateRoomCreateError(null);
  }, []);

  const handleGameLibraryTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, focusedTab: GameLibraryTab) => {
      const currentIndex = GAME_LIBRARY_TAB_CONFIGS.findIndex(
        (tab) => tab.id === focusedTab,
      );
      const lastIndex = GAME_LIBRARY_TAB_CONFIGS.length - 1;
      let nextIndex: number | null = null;

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = currentIndex <= 0 ? lastIndex : currentIndex - 1;
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = currentIndex >= lastIndex ? 0 : currentIndex + 1;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = lastIndex;
      }

      if (nextIndex === null) {
        return;
      }

      event.preventDefault();

      const nextTab = GAME_LIBRARY_TAB_CONFIGS[nextIndex];
      switchGameLibraryTab(nextTab.id);
      document.getElementById(getGameLibraryTabId(nextTab.id))?.focus();
    },
    [switchGameLibraryTab],
  );

  const returnToMenu = useCallback(() => {
    shouldRestoreMenuViewportRef.current = true;
    setIsGlobalLeaderboardVisible(false);
    setSelectedGameId(null);
    setSelectedReplayMode(null);
  }, []);

  const returnToProfile = useCallback(() => {
    window.location.href = "/profile";
  }, []);

  const returnToLibraryFromRoom = useCallback(() => {
    window.history.pushState(null, "", "/");
    setActiveRoomSession(null);
    setPrivateRoomCreateError(null);
    setPrivateRoomCreateRequest(null);
  }, []);

  const openGlobalLeaderboard = useCallback(() => {
    menuViewportRef.current = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
    shouldRestoreMenuViewportRef.current = false;

    setIsGlobalLeaderboardVisible(true);
  }, []);

  const restoreMenuViewport = useCallback((element: HTMLElement | null) => {
    if (element === null || !shouldRestoreMenuViewportRef.current) {
      return;
    }

    shouldRestoreMenuViewportRef.current = false;

    window.scrollTo(menuViewportRef.current.scrollX, menuViewportRef.current.scrollY);
  }, []);

  const updateParameterValue = useCallback((parameterKind: GameParameterKind, value: string) => {
    const parameter = GAME_PARAMETER_CONFIG[parameterKind];
    const normalizedValue = parameter.normalizeValue?.(value) ?? value;

    setParameterValues((currentValues) => ({
      ...currentValues,
      [parameterKind]: normalizedValue,
    }));
  }, []);

  const createPrivateRoomForGame = useCallback(
    async (game: GameCard) => {
      if (currentUserId === null) {
        setPrivateRoomCreateError(MULTIPLAYER_SIGN_IN_REQUIRED_MESSAGE);
        return;
      }

      if (privateRoomCreatingGameId !== null) {
        return;
      }

      const requestGeneration = roomCreateRequestGenerationRef.current + 1;
      roomCreateRequestGenerationRef.current = requestGeneration;
      setPrivateRoomCreateRequest({
        gameId: game.id,
        generation: requestGeneration,
        userId: currentUserId,
      });
      setPrivateRoomCreateError(null);

      try {
        const result = await createMultiplayerRoom({
          gameId: game.id,
          settings: createLauncherPrivateRoomSettings(game, parameterValues),
        });

        if (roomCreateRequestGenerationRef.current !== requestGeneration) {
          return;
        }

        const invitePath = getPrivateRoomInvitePath(result.room.code);

        if (invitePath !== null) {
          window.history.pushState(null, "", invitePath);
        }

        const activeRoom = {
          participantId: result.participantId,
          room: result.room,
          roomCode: result.room.code,
        } satisfies ActiveRoomSession;

        roomParticipantCapabilityHistoryRef.current.set(activeRoom.roomCode, {
          participantId: result.participantId,
          userId: currentUserId,
        });
        setActiveRoomSession(activeRoom);
      } catch (error) {
        if (roomCreateRequestGenerationRef.current !== requestGeneration) {
          return;
        }

        setPrivateRoomCreateError(
          error instanceof Error ? error.message : "Could not create room.",
        );
      } finally {
        if (roomCreateRequestGenerationRef.current === requestGeneration) {
          setPrivateRoomCreateRequest((currentRequest) =>
            currentRequest?.generation === requestGeneration ? null : currentRequest,
          );
        }
      }
    },
    [currentUserId, parameterValues, privateRoomCreatingGameId],
  );

  if (activeRoomSession !== null) {
    return (
      <MultiplayerRoomLobby
        initialAuthMode={initialAuthMode}
        initialParticipantId={activeRoomSession.participantId}
        initialRoom={activeRoomSession.room}
        initialRoomCode={activeRoomSession.roomCode}
        key={activeRoomSession.roomCode}
        onBackToLibrary={returnToLibraryFromRoom}
      />
    );
  }

  if (isGlobalLeaderboardVisible) {
    return <GlobalLeaderboardScreen onBackToMenu={returnToMenu} />;
  }

  if (selectedGame !== null) {
    const SelectedGame = PLAYABLE_GAME_COMPONENTS[selectedGame.id];
    const initialGameProps = createInitialGameProps(selectedGame, parameterValues);

    return (
      <SelectedGame
        {...initialGameProps}
        onBackToMenu={returnToMenu}
        onReplayBackToProfile={returnToProfile}
        replayMode={selectedReplayMode ?? undefined}
      />
    );
  }

  function renderGameParameter(game: GameCard, parameterKind: GameParameterKind) {
    const parameter = GAME_PARAMETER_CONFIG[parameterKind];
    const id = `${game.id}-${parameterKind}`;

    return (
      <GameParameterSelect
        ariaLabel={parameter.ariaLabel}
        id={id}
        key={parameterKind}
        label={parameter.label}
        onChange={(value) => updateParameterValue(parameterKind, value)}
        options={parameter.options}
        testId={parameterKind}
        value={parameterValues[parameterKind]}
      />
    );
  }

  return (
    <main
      className="min-h-svh bg-[var(--chrome-page)] px-4 py-6 text-[var(--chrome-ink)] sm:px-6 lg:py-8"
      data-testid="game-menu"
      ref={restoreMenuViewport}
    >
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center lg:grid-cols-[repeat(3,minmax(0,1fr))]">
          <div className="flex max-w-2xl items-center gap-4 lg:col-start-1">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] text-[var(--chrome-muted)] shadow-sm"
              aria-hidden="true"
            >
              <Gamepad2Icon className="size-5" />
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-[var(--chrome-ink)] sm:text-4xl">
              Game Library
            </h1>
          </div>
          <div className="flex w-full justify-start sm:col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-center">
            <button
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] px-3 text-sm font-semibold text-[var(--chrome-ink)] shadow-sm transition hover:bg-[var(--chrome-accent-faint)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)] active:translate-y-px"
              data-testid="global-leaderboard-open-button"
              onClick={openGlobalLeaderboard}
              type="button"
            >
              <TrophyIcon className="size-4" aria-hidden="true" />
              Leaderboards
            </button>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:col-start-2 sm:row-start-1 sm:w-auto sm:justify-end lg:col-start-3">
            <ThemeToggle testId="launcher-theme-toggle" />
            <UserAccountControls initialAuthMode={initialAuthMode} />
          </div>
        </header>

        <div className="flex flex-col gap-3">
          <div
            aria-label="Game library mode"
            className="grid w-full max-w-full grid-cols-2 gap-1 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-1 shadow-sm sm:inline-grid sm:w-fit sm:self-start"
            data-testid="game-library-tabs"
            role="tablist"
          >
            {GAME_LIBRARY_TAB_CONFIGS.map((tab) => {
              const isSelected = tab.id === activeGameLibraryTab;
              const TabIcon = tab.id === "multiplayer" ? UsersIcon : UserIcon;

              return (
                <button
                  aria-controls={getGameLibraryTabPanelId(tab.id)}
                  aria-selected={isSelected}
                  className={getGameLibraryTabButtonClassName(isSelected)}
                  data-testid={`game-library-${tab.id}-tab`}
                  id={getGameLibraryTabId(tab.id)}
                  key={tab.id}
                  onClick={() => switchGameLibraryTab(tab.id)}
                  onKeyDown={(event) => handleGameLibraryTabKeyDown(event, tab.id)}
                  role="tab"
                  tabIndex={isSelected ? 0 : -1}
                  type="button"
                >
                  <TabIcon className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />
                  <span
                    className="min-w-[4ch] text-center leading-tight [overflow-wrap:anywhere]"
                    data-testid={`game-library-${tab.id}-label`}
                  >
                    {tab.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className={getGameLibraryTabCountClassName(isSelected)}
                    data-testid={`game-library-${tab.id}-count`}
                  >
                    {tab.count}
                  </span>
                  <span className="sr-only">
                    {tab.count} {tab.count === 1 ? "game" : "games"}
                  </span>
                </button>
              );
            })}
          </div>

          {multiplayerStatusMessage !== null && (
            <p
              className={
                displayedPrivateRoomCreateError === null
                  ? "text-sm font-semibold text-[var(--chrome-muted)]"
                  : "text-sm font-semibold text-destructive"
              }
              data-testid={MULTIPLAYER_STATUS_ID}
              id={MULTIPLAYER_STATUS_ID}
              role={displayedPrivateRoomCreateError === null ? "status" : "alert"}
            >
              {multiplayerStatusMessage}
            </p>
          )}
        </div>

        {GAME_LIBRARY_TAB_CONFIGS.map((tab) => {
          const isActive = tab.id === activeGameLibraryTab;

          return (
            <div
              aria-labelledby={getGameLibraryTabId(tab.id)}
              className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]"
              data-testid={`game-library-${tab.id}-panel`}
              hidden={!isActive}
              id={getGameLibraryTabPanelId(tab.id)}
              key={tab.id}
              role="tabpanel"
            >
              {isActive &&
                activeGameCards.map((game) => (
                  <GameCardArticle
                    action={tab.id === "multiplayer" ? "host-room" : "play"}
                    descriptionId={
                      tab.id === "multiplayer" && multiplayerStatusMessage !== null
                        ? MULTIPLAYER_STATUS_ID
                        : undefined
                    }
                    game={game}
                    isPending={privateRoomCreatingGameId === game.id}
                    key={game.id}
                    onSelectGame={() => {
                      if (tab.id === "multiplayer") {
                        void createPrivateRoomForGame(game);
                        return;
                      }

                      selectGame(game.id);
                    }}
                    renderGameParameter={renderGameParameter}
                    versionedArtworkSrc={getVersionedGameArtworkSrc(game)}
                  />
                ))}
            </div>
          );
        })}
      </section>
    </main>
  );
}

type GameCardArticleProps = {
  action: GameCardAction;
  descriptionId?: string;
  game: GameCard;
  isPending?: boolean;
  onSelectGame: () => void;
  renderGameParameter: (game: GameCard, parameterKind: GameParameterKind) => ReactNode;
  versionedArtworkSrc: string;
};

function GameCardArticle({
  action,
  descriptionId,
  game,
  isPending = false,
  onSelectGame,
  renderGameParameter,
  versionedArtworkSrc,
}: GameCardArticleProps) {
  const ActionIcon = action === "host-room" ? UsersIcon : PlayIcon;
  const actionLabel =
    action === "host-room"
      ? isPending
        ? `Creating ${game.label} room`
        : `Host ${game.label} room`
      : `Play ${game.label}`;

  return (
    <article className="group flex min-h-72 w-full flex-col overflow-hidden rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--chrome-accent)_45%,var(--chrome-border))] hover:shadow-[0_22px_70px_var(--chrome-shadow-soft)] focus-within:border-[var(--chrome-accent)] focus-within:ring-3 focus-within:ring-[var(--chrome-focus-ring)]">
      <button
        aria-busy={isPending}
        aria-describedby={descriptionId}
        aria-label={actionLabel}
        className="flex flex-1 flex-col text-left focus-visible:outline-none"
        data-testid={`game-card-${game.id}`}
        disabled={isPending}
        onClick={onSelectGame}
        type="button"
      >
        <GameCardArtworkFrame
          accentClassName={game.accentClassName}
          artwork={game.artwork}
          artworkSrc={versionedArtworkSrc}
          backgroundSizes="(min-width: 1200px) 23.333rem, (min-width: 944px) calc(33.333vw - 1.667rem), (min-width: 640px) calc(50vw - 2rem), calc(100vw - 2rem)"
        />

        <span className="flex flex-1 flex-col p-4 pb-0">
          <span className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-2xl font-semibold tracking-normal">
                {game.label}
              </span>
              <span className="text-sm font-medium text-[var(--chrome-muted)]">
                {game.description}
              </span>
            </span>
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--chrome-accent-soft)] text-[var(--chrome-ink)] transition group-hover:bg-[var(--chrome-accent)] group-hover:text-[var(--chrome-accent-ink)]"
              aria-hidden="true"
            >
              <ActionIcon className={cn("size-4", isPending && "animate-pulse")} />
            </span>
          </span>
        </span>
      </button>

      <div className="mt-auto grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2 p-4">
        {game.parameters.map((parameter) => renderGameParameter(game, parameter))}
      </div>
    </article>
  );
}

type GameParameterSelectProps = {
  ariaLabel?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: readonly {
    label: string;
    value: string;
  }[];
  testId: string;
  value: string;
};

function GameParameterSelect({
  ariaLabel,
  id,
  label,
  onChange,
  options,
  testId,
  value,
}: GameParameterSelectProps) {
  return (
    <div className="rounded-md border border-[var(--chrome-border)] p-2">
      <label
        className="block text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--chrome-muted)]"
        htmlFor={id}
      >
        {label}
      </label>
      <select
        aria-label={ariaLabel ?? label}
        className="mt-1 h-8 w-full min-w-0 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] px-2 text-sm font-semibold text-[var(--chrome-ink)] outline-none transition focus-visible:border-[var(--chrome-accent)] focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)]"
        data-testid={testId}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function createLauncherPrivateRoomSettings(
  game: GameCard,
  parameterValues: GameParameterValues,
): PrivateRoomSettings {
  const parameters = Object.fromEntries(
    game.parameters.map((parameterKind) => [parameterKind, parameterValues[parameterKind]]),
  );

  return Object.keys(parameters).length === 0
    ? { gameId: game.id }
    : {
        gameId: game.id,
        parameters,
      };
}

export function getLauncherPrivateRoomCodeFromSearch(search: string) {
  const roomCode = new URLSearchParams(search).get("room");

  if (roomCode === null) {
    return null;
  }

  return normalizePrivateRoomCode(roomCode) ?? roomCode.trim();
}

function createUnloadedActiveRoomSession(
  roomCode: string,
  participantId: string | null = null,
): ActiveRoomSession {
  return {
    participantId,
    room: null,
    roomCode,
  };
}

function getGameLibraryTabId(tab: GameLibraryTab) {
  return `game-library-${tab}-tab`;
}

function getGameLibraryTabPanelId(tab: GameLibraryTab) {
  return `game-library-${tab}-panel`;
}

function getGameLibraryTabButtonClassName(isSelected: boolean) {
  // Selection colors switch together so intermediate animation frames retain contrast.
  return cn(
    "inline-flex min-h-11 min-w-0 flex-wrap items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-sm font-semibold transition-transform active:translate-y-px focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--chrome-ink)] forced-colors:focus-visible:outline-[Highlight] sm:gap-2 sm:px-3",
    isSelected
      ? "border-[var(--chrome-selection-border)] bg-[var(--chrome-selection)] text-[var(--chrome-selection-ink)] shadow-sm forced-colors:border-[Highlight] forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]"
      : "border-transparent text-[var(--chrome-muted)] hover:bg-[var(--chrome-accent-faint)] hover:text-[var(--chrome-ink)] active:bg-[var(--chrome-accent-soft)]",
  );
}

function getGameLibraryTabCountClassName(isSelected: boolean) {
  return cn(
    "inline-flex min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 text-xs tabular-nums",
    isSelected
      ? "bg-[var(--chrome-selection-soft)] text-[var(--chrome-selection-ink)] forced-colors:bg-transparent forced-colors:text-[HighlightText]"
      : "bg-[var(--chrome-accent-faint)] text-[var(--chrome-muted)]",
  );
}
