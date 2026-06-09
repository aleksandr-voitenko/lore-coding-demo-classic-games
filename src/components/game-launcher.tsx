"use client";

import { Gamepad2Icon, PlayIcon, TrophyIcon } from "lucide-react";
import Image from "next/image";
import {
  type ReactNode,
  useCallback,
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
import { PLAYABLE_GAME_COMPONENTS } from "@/components/game-launcher-playables";
import { UserAccountControls } from "@/components/user-account-controls";
import type { UserAuthMode } from "@/lib/user-profile";

type MenuViewport = {
  scrollX: number;
  scrollY: number;
};

type GameLauncherProps = {
  initialAuthMode?: UserAuthMode | null;
  initialReplayGameId?: GameId | null;
};

export function GameLauncher({
  initialAuthMode = null,
  initialReplayGameId = null,
}: GameLauncherProps) {
  const [selectedGameId, setSelectedGameId] = useState<GameId | null>(initialReplayGameId);
  const [selectedReplayMode, setSelectedReplayMode] = useState<"latest" | null>(
    initialReplayGameId === null ? null : "latest",
  );
  const [parameterValues, setParameterValues] = useState<GameParameterValues>(() =>
    createDefaultParameterValues(),
  );
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
    setSelectedGameId(null);
    setSelectedReplayMode(null);
  }, []);

  const returnToProfile = useCallback(() => {
    window.location.href = "/profile";
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
      className="min-h-svh bg-[var(--snake-page)] px-4 py-6 text-[var(--snake-ink)] sm:px-6 lg:py-8"
      data-testid="game-menu"
      ref={restoreMenuViewport}
    >
      <section className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-6xl flex-col justify-center gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex max-w-2xl items-center gap-4">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] text-[var(--snake-muted)] shadow-sm"
              aria-hidden="true"
            >
              <Gamepad2Icon className="size-5" />
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-black sm:text-4xl">
              Game Library
            </h1>
          </div>
          <UserAccountControls initialAuthMode={initialAuthMode} />
        </header>

        <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
          {GAME_CARDS.map((game) => (
            <GameCardArticle
              game={game}
              key={game.id}
              onSelectGame={() => selectGame(game.id)}
              renderGameParameter={renderGameParameter}
              versionedArtworkSrc={getVersionedGameArtworkSrc(game)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-[var(--snake-muted)]">
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

type GameCardArticleProps = {
  game: GameCard;
  onSelectGame: () => void;
  renderGameParameter: (game: GameCard, parameterKind: GameParameterKind) => ReactNode;
  versionedArtworkSrc: string;
};

function GameCardArticle({
  game,
  onSelectGame,
  renderGameParameter,
  versionedArtworkSrc,
}: GameCardArticleProps) {
  return (
    <article className="group flex min-h-72 w-full flex-col overflow-hidden rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--snake-head)_45%,var(--snake-border))] hover:shadow-[0_22px_70px_color-mix(in_oklch,var(--snake-board)_14%,transparent)] focus-within:border-[var(--snake-head)] focus-within:ring-3 focus-within:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)]">
      <button
        aria-label={`Play ${game.label}`}
        className="flex flex-1 flex-col text-left focus-visible:outline-none"
        data-testid={`game-card-${game.id}`}
        onClick={onSelectGame}
        type="button"
      >
        <span className="relative block h-40 w-full overflow-hidden bg-[var(--snake-board)]">
          <span
            className={`absolute inset-x-0 top-0 h-1 ${game.accentClassName}`}
            aria-hidden="true"
          />
          <Image
            alt=""
            aria-hidden="true"
            className="scale-110 object-cover opacity-55 blur-[2px]"
            fill
            loading={game.artwork.loading}
            priority={game.artwork.priority}
            sizes="(min-width: 640px) 24rem, calc(100vw - 2rem)"
            src={versionedArtworkSrc}
            unoptimized
          />
          <span className="absolute inset-0 bg-[color-mix(in_oklch,var(--snake-board)_38%,transparent)]" />
          <span className="absolute inset-3 flex items-center justify-center">
            <Image
              alt=""
              aria-hidden="true"
              className="h-full w-auto rounded-md border border-[color-mix(in_oklch,var(--snake-board)_16%,white)] object-contain shadow-[0_18px_50px_color-mix(in_oklch,var(--snake-board)_34%,transparent)]"
              height={game.artwork.height}
              loading={game.artwork.loading}
              priority={game.artwork.priority}
              src={versionedArtworkSrc}
              unoptimized
              width={game.artwork.width}
            />
          </span>
        </span>

        <span className="flex flex-1 flex-col p-4 pb-0">
          <span className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-2xl font-semibold tracking-normal">
                {game.label}
              </span>
              <span className="text-sm font-medium text-[var(--snake-muted)]">
                {game.description}
              </span>
            </span>
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklch,var(--snake-head)_16%,white)] text-[var(--snake-ink)] transition group-hover:bg-[var(--snake-head)]"
              aria-hidden="true"
            >
              <PlayIcon className="size-4" />
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
    <div className="rounded-md border border-[var(--snake-border)] p-2">
      <label
        className="block text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--snake-muted)]"
        htmlFor={id}
      >
        {label}
      </label>
      <select
        aria-label={ariaLabel ?? label}
        className="mt-1 h-8 w-full min-w-0 rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] px-2 text-sm font-semibold text-[var(--snake-ink)] outline-none transition focus-visible:border-[var(--snake-head)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)]"
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
