"use client";

import { ArrowLeftIcon, TrophyIcon } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";

import { GameCardArtworkFrame } from "@/components/game-card-artwork-frame";
import {
  createGlobalLeaderboardSlots,
  fetchGlobalLeaderboards,
  formatGlobalLeaderboardScore,
  getGlobalLeaderboardGameLabel,
  GLOBAL_LEADERBOARD_TARGETS,
  type GlobalLeaderboardSnapshot,
} from "@/lib/global-leaderboard";
import {
  getGameCatalogArtwork,
  getVersionedGameCatalogArtworkSrc,
} from "@/lib/game-catalog";

type GlobalLeaderboardScreenProps = {
  onBackToMenu: () => void;
  socialCenterTrigger?: ReactNode;
};

function createEmptyGlobalLeaderboardSnapshots(): GlobalLeaderboardSnapshot[] {
  return GLOBAL_LEADERBOARD_TARGETS.map((target) => ({
    entries: [],
    loadFailed: false,
    target,
  }));
}

export function GlobalLeaderboardScreen({
  onBackToMenu,
  socialCenterTrigger,
}: GlobalLeaderboardScreenProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [leaderboards, setLeaderboards] = useState<GlobalLeaderboardSnapshot[]>(
    createEmptyGlobalLeaderboardSnapshots,
  );

  const handleBackToMenu = useCallback(() => {
    onBackToMenu();
  }, [onBackToMenu]);

  useEffect(() => {
    let isCurrent = true;

    fetchGlobalLeaderboards().then((nextLeaderboards) => {
      if (!isCurrent) {
        return;
      }

      setLeaderboards(nextLeaderboards);
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      handleBackToMenu();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleBackToMenu]);

  return (
    <main
      className="min-h-svh bg-[var(--chrome-page)] px-4 py-6 text-[var(--chrome-ink)] sm:px-6 lg:py-8"
      data-testid="global-leaderboard-screen"
    >
      <section className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-6xl flex-col justify-center gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 max-w-2xl items-center gap-4">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] text-[var(--chrome-muted)] shadow-sm"
              aria-hidden="true"
            >
              <TrophyIcon className="size-5" />
            </div>
            <h1 className="min-w-0 text-3xl font-semibold tracking-normal text-[var(--chrome-ink)] sm:text-4xl">
              Leaderboards
            </h1>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {socialCenterTrigger}
            <button
              className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] px-3 text-sm font-semibold text-[var(--chrome-ink)] shadow-sm transition hover:bg-[var(--chrome-accent-faint)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)] active:translate-y-px sm:w-auto"
              data-testid="global-leaderboard-back-button"
              onClick={handleBackToMenu}
              type="button"
            >
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              Games
            </button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leaderboards.map((leaderboard) => (
            <GlobalLeaderboardCard
              isLoading={isLoading}
              key={leaderboard.target.gameId}
              leaderboard={leaderboard}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

type GlobalLeaderboardCardProps = {
  isLoading: boolean;
  leaderboard: GlobalLeaderboardSnapshot;
};

function GlobalLeaderboardCard({
  isLoading,
  leaderboard,
}: GlobalLeaderboardCardProps) {
  const { entries, loadFailed, target } = leaderboard;
  const slots = createGlobalLeaderboardSlots(entries);
  const artwork = getGameCatalogArtwork(target.gameId);
  const artworkSrc = getVersionedGameCatalogArtworkSrc(artwork);
  const gameLabel = getGlobalLeaderboardGameLabel(target);

  return (
    <article
      aria-busy={isLoading}
      className="flex min-h-80 flex-col overflow-hidden rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] text-[var(--chrome-ink)] shadow-sm"
      data-testid={`global-leaderboard-${target.gameId}`}
    >
      <GameCardArtworkFrame
        artwork={artwork}
        artworkSrc={artworkSrc}
        backgroundSizes="(min-width: 1280px) 23.333rem, (min-width: 1200px) 35.5rem, (min-width: 768px) calc(50vw - 2rem), (min-width: 640px) calc(100vw - 3rem), calc(100vw - 2rem)"
      />

      <header className="flex flex-col gap-1 px-4 pt-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-xl font-semibold tracking-normal">{gameLabel}</h2>
          <p className="text-sm font-medium text-[var(--chrome-muted)]">
            {target.variantLabel}
          </p>
        </div>
      </header>

      <ol className="flex flex-1 flex-col gap-2 p-4">
        {slots.map((entry, index) => (
          <li
            className="grid min-h-11 grid-cols-[1.75rem_minmax(0,1fr)_5rem] items-center gap-2 rounded-md bg-[var(--chrome-accent-faint)] px-2.5 py-2 text-sm"
            data-testid={`global-leaderboard-${target.gameId}-slot-${index + 1}`}
            key={index}
          >
            <span className="font-mono text-xs font-semibold text-[var(--chrome-muted)]">
              {index + 1}
            </span>
            <span className="truncate text-left font-medium">
              {entry ? entry.name || "Anonymous" : isLoading ? "Loading" : "Open"}
            </span>
            <span className="text-right font-mono font-semibold">
              {entry ? formatGlobalLeaderboardScore(target, entry.score) : "-"}
            </span>
          </li>
        ))}
      </ol>

      {loadFailed ? (
        <p
          aria-live="polite"
          className="px-4 pb-4 text-xs font-medium text-[var(--chrome-muted)]"
          data-testid={`global-leaderboard-${target.gameId}-status`}
        >
          Leaderboard unavailable
        </p>
      ) : null}
    </article>
  );
}
