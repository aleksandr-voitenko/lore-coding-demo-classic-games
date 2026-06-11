import Image from "next/image";
import Link from "next/link";
import { PlayIcon } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  compareGameCatalogOrder,
  formatGameCatalogLabel,
  getGameCatalogArtwork,
  getVersionedGameCatalogArtworkSrc,
} from "@/lib/game-catalog";
import { formatProfileLastPlayed } from "@/lib/profile-time";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { USER_SESSION_COOKIE_NAME } from "@/lib/server/user-session-cookie";
import type { UserProfileGameStat } from "@/lib/user-profile";
import { ProfileEscapeToLauncher } from "./profile-escape-to-launcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getBestMetric(game: UserProfileGameStat) {
  if (game.fastestWinScore !== null) {
    return {
      label: "Fastest clear",
      value: `${game.fastestWinScore}s`,
    };
  }

  if (game.bestScore !== null) {
    return {
      label: "Best score",
      value: String(game.bestScore),
    };
  }

  return {
    label: "Best score",
    value: "-",
  };
}

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value ?? null;
  const store = getUserProfileStore();
  const user = await store.getUserBySessionToken(sessionToken);

  if (user === null) {
    redirect("/?auth=login");
  }

  const profile = await store.getUserProfile(user);
  const games = [...profile.games].sort((leftGame, rightGame) =>
    compareGameCatalogOrder(leftGame.gameId, rightGame.gameId),
  );

  return (
    <main
      className="min-h-svh bg-[var(--chrome-page)] px-4 py-6 text-[var(--chrome-ink)] sm:px-6 lg:py-8"
      data-testid="profile-page"
    >
      <ProfileEscapeToLauncher />
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-[var(--chrome-muted)]">Profile</p>
            <h1 className="text-3xl font-semibold tracking-normal text-[var(--chrome-ink)] sm:text-4xl">
              {profile.user.displayName}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] px-3 text-sm font-medium text-[var(--chrome-ink)] shadow-sm transition hover:bg-[var(--chrome-accent-faint)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)]"
              href="/"
            >
              Back to games
            </Link>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ProfileMetric label="Total time" value={formatDuration(profile.totalActiveDurationMs)} />
          <ProfileMetric label="Sessions" value={String(profile.totalSessionsPlayed)} />
          <ProfileMetric label="Games played" value={String(profile.games.length)} />
          <ProfileMetric
            label="Wins"
            value={String(profile.games.reduce((total, game) => total + game.wins, 0))}
          />
        </div>

        {games.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] shadow-sm">
            <div className="grid grid-cols-[5.5rem_minmax(9rem,1.2fr)_repeat(6,minmax(5rem,0.7fr))] gap-0 overflow-x-auto">
              <div className="contents text-xs font-semibold uppercase tracking-normal text-[var(--chrome-muted)]">
                <div className="border-b border-[var(--chrome-border)] px-3 py-2">Preview</div>
                <div className="border-b border-[var(--chrome-border)] px-3 py-2">Game</div>
                <div className="border-b border-[var(--chrome-border)] px-3 py-2 text-right">
                  Time
                </div>
                <div className="border-b border-[var(--chrome-border)] px-3 py-2 text-right">
                  Sessions
                </div>
                <div className="border-b border-[var(--chrome-border)] px-3 py-2 text-right">
                  Wins
                </div>
                <div className="border-b border-[var(--chrome-border)] px-3 py-2 text-right">
                  Best
                </div>
                <div className="border-b border-[var(--chrome-border)] px-3 py-2 text-right">
                  Last Replay
                </div>
                <div className="border-b border-[var(--chrome-border)] px-3 py-2 text-right">
                  Last played
                </div>
              </div>
              {games.map((game) => {
                const bestMetric = getBestMetric(game);
                const gameArtwork = getGameCatalogArtwork(game.gameId);
                const gameLabel = formatGameCatalogLabel(game.gameId);

                return (
                  <div className="contents text-sm" key={game.gameId}>
                    <div className="flex items-center border-b border-[var(--chrome-border)] px-3 py-2">
                      <span className="relative block h-10 w-16 overflow-hidden rounded border border-[color-mix(in_oklch,var(--chrome-border)_70%,var(--chrome-panel))] bg-[var(--snake-board)]">
                        {gameArtwork !== null ? (
                          <Image
                            alt=""
                            aria-hidden="true"
                            className="h-full w-full object-cover"
                            height={gameArtwork.height}
                            src={getVersionedGameCatalogArtworkSrc(gameArtwork)}
                            unoptimized
                            width={gameArtwork.width}
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="flex h-full w-full items-center justify-center text-xs text-[var(--chrome-muted)]"
                          >
                            -
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center border-b border-[var(--chrome-border)] px-3 py-3 font-semibold">
                      {gameLabel}
                    </div>
                    <div className="flex items-center justify-end border-b border-[var(--chrome-border)] px-3 py-3 text-right font-mono">
                      {formatDuration(game.totalActiveDurationMs)}
                    </div>
                    <div className="flex items-center justify-end border-b border-[var(--chrome-border)] px-3 py-3 text-right font-mono">
                      {game.sessionsPlayed}
                    </div>
                    <div className="flex items-center justify-end border-b border-[var(--chrome-border)] px-3 py-3 text-right font-mono">
                      {game.wins}
                    </div>
                    <div
                      className="flex items-center justify-end border-b border-[var(--chrome-border)] px-3 py-3 text-right font-mono"
                      title={bestMetric.label}
                    >
                      {bestMetric.value}
                    </div>
                    <div className="flex items-center justify-end border-b border-[var(--chrome-border)] px-3 py-3 text-right">
                      {game.hasLastReplay ? (
                        <Link
                          aria-label={`Play latest ${gameLabel} replay`}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] text-[var(--chrome-ink)] shadow-sm transition hover:bg-[var(--chrome-accent-faint)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)]"
                          data-testid={`profile-${game.gameId}-last-replay`}
                          href={`/?replay=${game.gameId}`}
                        >
                          <PlayIcon className="size-4" aria-hidden="true" />
                        </Link>
                      ) : (
                        <span className="font-mono text-[var(--chrome-muted)]">-</span>
                      )}
                    </div>
                    <div className="flex items-center justify-end border-b border-[var(--chrome-border)] px-3 py-3 text-right text-[var(--chrome-muted)]">
                      {formatProfileLastPlayed(game.lastPlayedAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-5 text-sm font-medium text-[var(--chrome-muted)] shadow-sm">
            No signed-in sessions yet.
          </div>
        )}
      </section>
    </main>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm">
      <p className="text-sm font-semibold text-[var(--chrome-muted)]">{label}</p>
      <p className="mt-1 font-mono text-3xl font-semibold tracking-normal text-[var(--chrome-ink)]">{value}</p>
    </div>
  );
}
