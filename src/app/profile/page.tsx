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
    <main className="min-h-svh bg-[var(--snake-page)] px-4 py-6 text-[var(--snake-ink)] sm:px-6 lg:py-8">
      <ProfileEscapeToLauncher />
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-[var(--snake-muted)]">Profile</p>
            <h1 className="text-3xl font-semibold tracking-normal text-black sm:text-4xl">
              {profile.user.displayName}
            </h1>
          </div>
          <Link
            className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] px-3 text-sm font-medium shadow-sm transition hover:bg-[color-mix(in_oklch,var(--snake-head)_12%,white)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)]"
            href="/"
          >
            Back to games
          </Link>
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
          <div className="overflow-hidden rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] shadow-sm">
            <div className="grid grid-cols-[5.5rem_minmax(9rem,1.2fr)_repeat(6,minmax(5rem,0.7fr))] gap-0 overflow-x-auto">
              <div className="contents text-xs font-semibold uppercase tracking-normal text-[var(--snake-muted)]">
                <div className="border-b border-[var(--snake-border)] px-3 py-2">Preview</div>
                <div className="border-b border-[var(--snake-border)] px-3 py-2">Game</div>
                <div className="border-b border-[var(--snake-border)] px-3 py-2 text-right">
                  Time
                </div>
                <div className="border-b border-[var(--snake-border)] px-3 py-2 text-right">
                  Sessions
                </div>
                <div className="border-b border-[var(--snake-border)] px-3 py-2 text-right">
                  Wins
                </div>
                <div className="border-b border-[var(--snake-border)] px-3 py-2 text-right">
                  Best
                </div>
                <div className="border-b border-[var(--snake-border)] px-3 py-2 text-right">
                  Last Replay
                </div>
                <div className="border-b border-[var(--snake-border)] px-3 py-2 text-right">
                  Last played
                </div>
              </div>
              {games.map((game) => {
                const bestMetric = getBestMetric(game);
                const gameArtwork = getGameCatalogArtwork(game.gameId);
                const gameLabel = formatGameCatalogLabel(game.gameId);

                return (
                  <div className="contents text-sm" key={game.gameId}>
                    <div className="flex items-center border-b border-[var(--snake-border)] px-3 py-2">
                      <span className="relative block h-10 w-16 overflow-hidden rounded border border-[color-mix(in_oklch,var(--snake-border)_70%,white)] bg-[var(--snake-board)]">
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
                            className="flex h-full w-full items-center justify-center text-xs text-[var(--snake-muted)]"
                          >
                            -
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center border-b border-[var(--snake-border)] px-3 py-3 font-semibold">
                      {gameLabel}
                    </div>
                    <div className="flex items-center justify-end border-b border-[var(--snake-border)] px-3 py-3 text-right font-mono">
                      {formatDuration(game.totalActiveDurationMs)}
                    </div>
                    <div className="flex items-center justify-end border-b border-[var(--snake-border)] px-3 py-3 text-right font-mono">
                      {game.sessionsPlayed}
                    </div>
                    <div className="flex items-center justify-end border-b border-[var(--snake-border)] px-3 py-3 text-right font-mono">
                      {game.wins}
                    </div>
                    <div
                      className="flex items-center justify-end border-b border-[var(--snake-border)] px-3 py-3 text-right font-mono"
                      title={bestMetric.label}
                    >
                      {bestMetric.value}
                    </div>
                    <div className="flex items-center justify-end border-b border-[var(--snake-border)] px-3 py-3 text-right">
                      {game.hasLastReplay ? (
                        <Link
                          aria-label={`Play latest ${gameLabel} replay`}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] text-[var(--snake-ink)] shadow-sm transition hover:bg-[color-mix(in_oklch,var(--snake-head)_12%,white)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)]"
                          data-testid={`profile-${game.gameId}-last-replay`}
                          href={`/?replay=${game.gameId}`}
                        >
                          <PlayIcon className="size-4" aria-hidden="true" />
                        </Link>
                      ) : (
                        <span className="font-mono text-[var(--snake-muted)]">-</span>
                      )}
                    </div>
                    <div className="flex items-center justify-end border-b border-[var(--snake-border)] px-3 py-3 text-right text-[var(--snake-muted)]">
                      {formatProfileLastPlayed(game.lastPlayedAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] p-5 text-sm font-medium text-[var(--snake-muted)] shadow-sm">
            No signed-in sessions yet.
          </div>
        )}
      </section>
    </main>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] p-4 shadow-sm">
      <p className="text-sm font-semibold text-[var(--snake-muted)]">{label}</p>
      <p className="mt-1 font-mono text-3xl font-semibold tracking-normal text-black">{value}</p>
    </div>
  );
}
