"use client";

import { Gamepad2Icon, PlayIcon, TrophyIcon, UsersIcon } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
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
import {
  MultiplayerRoomLobby,
  createMultiplayerRoom,
} from "@/components/multiplayer-room-lobby";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAccountControls } from "@/components/user-account-controls";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getPrivateRoomInvitePath,
  type PrivateRoom,
  type PrivateRoomSettings,
} from "@/lib/multiplayer/room";
import type { UserAuthMode } from "@/lib/user-profile";

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

type PrivateRoomHostActionProps = {
  error: string | null;
  gameId: GameId;
  isCreating: boolean;
  isSignedIn: boolean;
  onCreatePrivateRoom: () => void;
};

const PRIVATE_ROOM_HOSTABLE_GAME_IDS = new Set<GameId>(["pong", "space-invaders"]);

export function GameLauncher({
  initialAuthMode = null,
  initialReplayGameId = null,
  initialRoomCode = null,
}: GameLauncherProps) {
  const { user } = useCurrentUser();
  const [activeRoomSession, setActiveRoomSession] = useState<ActiveRoomSession | null>(() =>
    initialRoomCode === null
      ? null
      : {
          participantId: null,
          room: null,
          roomCode: initialRoomCode,
        },
  );
  const [selectedGameId, setSelectedGameId] = useState<GameId | null>(initialReplayGameId);
  const [selectedReplayMode, setSelectedReplayMode] = useState<"latest" | null>(
    initialReplayGameId === null ? null : "latest",
  );
  const [isGlobalLeaderboardVisible, setIsGlobalLeaderboardVisible] = useState(false);
  const [parameterValues, setParameterValues] = useState<GameParameterValues>(() =>
    createDefaultParameterValues(),
  );
  const [privateRoomCreateError, setPrivateRoomCreateError] = useState<string | null>(null);
  const [privateRoomCreatingGameId, setPrivateRoomCreatingGameId] = useState<GameId | null>(null);
  // Return-to-menu paths opt into restoring this viewport after a full-screen game view exits.
  const menuViewportRef = useRef<MenuViewport>({ scrollX: 0, scrollY: 0 });
  const shouldRestoreMenuViewportRef = useRef(false);

  const selectedGame = GAME_CARDS.find((game) => game.id === selectedGameId) ?? null;

  const selectGame = useCallback((gameId: GameId) => {
    menuViewportRef.current = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
    shouldRestoreMenuViewportRef.current = false;

    setSelectedGameId(gameId);
    setSelectedReplayMode(null);
  }, []);

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
    setPrivateRoomCreatingGameId(null);
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
      if (user === null || privateRoomCreatingGameId !== null) {
        return;
      }

      setPrivateRoomCreatingGameId(game.id);
      setPrivateRoomCreateError(null);

      try {
        const result = await createMultiplayerRoom({
          gameId: game.id,
          settings: createLauncherPrivateRoomSettings(game, parameterValues),
        });
        const invitePath = getPrivateRoomInvitePath(result.room.code);

        if (invitePath !== null) {
          window.history.pushState(null, "", invitePath);
        }

        setActiveRoomSession({
          participantId: result.participantId,
          room: result.room,
          roomCode: result.room.code,
        });
      } catch (error) {
        setPrivateRoomCreateError(
          error instanceof Error ? error.message : "Could not create room.",
        );
      } finally {
        setPrivateRoomCreatingGameId(null);
      }
    },
    [parameterValues, privateRoomCreatingGameId, user],
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
      <section className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-6xl flex-col justify-center gap-6">
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

        <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
          {GAME_CARDS.map((game) => (
            <GameCardArticle
              game={game}
              key={game.id}
              onSelectGame={() => selectGame(game.id)}
              privateRoomHostAction={
                isPrivateRoomHostableGame(game.id) ? (
                  <PrivateRoomHostAction
                    error={privateRoomCreateError}
                    gameId={game.id}
                    isCreating={privateRoomCreatingGameId === game.id}
                    isSignedIn={user !== null}
                    onCreatePrivateRoom={() => {
                      void createPrivateRoomForGame(game);
                    }}
                  />
                ) : null
              }
              renderGameParameter={renderGameParameter}
              versionedArtworkSrc={getVersionedGameArtworkSrc(game)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-[var(--chrome-muted)]">
          <TrophyIcon className="size-4" aria-hidden="true" />
          <span>
            {GAME_CARDS.length === 1
              ? "1 game available"
              : `${GAME_CARDS.length} games available`}
          </span>
        </div>
      </section>
    </main>
  );
}

function isPrivateRoomHostableGame(gameId: GameId) {
  return PRIVATE_ROOM_HOSTABLE_GAME_IDS.has(gameId);
}

type GameCardArticleProps = {
  game: GameCard;
  onSelectGame: () => void;
  privateRoomHostAction?: ReactNode;
  renderGameParameter: (game: GameCard, parameterKind: GameParameterKind) => ReactNode;
  versionedArtworkSrc: string;
};

function GameCardArticle({
  game,
  onSelectGame,
  privateRoomHostAction = null,
  renderGameParameter,
  versionedArtworkSrc,
}: GameCardArticleProps) {
  return (
    <article className="group flex min-h-72 w-full flex-col overflow-hidden rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--chrome-accent)_45%,var(--chrome-border))] hover:shadow-[0_22px_70px_var(--chrome-shadow-soft)] focus-within:border-[var(--chrome-accent)] focus-within:ring-3 focus-within:ring-[var(--chrome-focus-ring)]">
      <button
        aria-label={`Play ${game.label}`}
        className="flex flex-1 flex-col text-left focus-visible:outline-none"
        data-testid={`game-card-${game.id}`}
        onClick={onSelectGame}
        type="button"
      >
        <GameCardArtworkFrame
          accentClassName={game.accentClassName}
          artwork={game.artwork}
          artworkSrc={versionedArtworkSrc}
          backgroundSizes="(min-width: 640px) 24rem, calc(100vw - 2rem)"
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
              <PlayIcon className="size-4" />
            </span>
          </span>
        </span>
      </button>

      <div className="mt-auto grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2 p-4">
        {game.parameters.map((parameter) => renderGameParameter(game, parameter))}
        {privateRoomHostAction}
      </div>
    </article>
  );
}

function PrivateRoomHostAction({
  error,
  gameId,
  isCreating,
  isSignedIn,
  onCreatePrivateRoom,
}: PrivateRoomHostActionProps) {
  const statusId = `${gameId}-private-room-host-status`;
  const buttonLabel = isSignedIn
    ? isCreating
      ? "Creating room"
      : "Host room"
    : "Sign in to host";

  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-md border border-[var(--chrome-border)] p-2">
      <Button
        aria-describedby={statusId}
        className="w-full"
        data-testid={`private-room-host-${gameId}-button`}
        disabled={!isSignedIn || isCreating}
        onClick={onCreatePrivateRoom}
        type="button"
        variant={isSignedIn ? "default" : "outline"}
      >
        <UsersIcon data-icon="inline-start" />
        {buttonLabel}
      </Button>
      <p
        className={
          error === null
            ? "text-xs font-semibold text-[var(--chrome-muted)]"
            : "text-xs font-semibold text-destructive"
        }
        data-testid={`private-room-host-${gameId}-status`}
        id={statusId}
        role={error === null ? "status" : "alert"}
      >
        {error ?? (isSignedIn ? "Private room" : "Account required")}
      </p>
    </div>
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
