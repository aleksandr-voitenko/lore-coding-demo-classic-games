"use client";

import { Gamepad2Icon, PlayIcon, TrophyIcon } from "lucide-react";
import Image from "next/image";
import { type ComponentType, useCallback, useState } from "react";

import { SnakeGame } from "@/components/snake-game";
import { TetrisGame } from "@/components/tetris-game";

type GameId = "snake" | "tetris";

type PlayableGameProps = {
  onBackToMenu: () => void;
};

type GameCard = {
  accentClassName: string;
  artwork: {
    height: number;
    loading?: "eager" | "lazy";
    priority?: boolean;
    src: string;
    unoptimized?: boolean;
    width: number;
  };
  component: ComponentType<PlayableGameProps>;
  description: string;
  id: GameId;
  label: string;
  stats: Array<{
    label: string;
    value: string;
  }>;
};

const GAME_CARDS: GameCard[] = [
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--snake-head),var(--snake-bonus-food),var(--snake-speed-food),var(--snake-slow-food))]",
    artwork: {
      height: 249,
      priority: true,
      src: "/images/snake-game-card.png",
      width: 250,
    },
    component: SnakeGame,
    description: "A classic score chase with obstacles, timed food, and saved best runs.",
    id: "snake",
    label: "Classic Snake",
    stats: [
      { label: "Mode", value: "Score" },
      { label: "Board", value: "11-25" },
      { label: "Records", value: "Top 3" },
    ],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--tetris-cyan),var(--tetris-yellow),var(--tetris-purple),var(--tetris-red))]",
    artwork: {
      height: 250,
      loading: "eager",
      src: "/images/tetris-game-card.svg",
      unoptimized: true,
      width: 250,
    },
    component: TetrisGame,
    description: "A falling-block survival game with line clears, scoring, and rising speed.",
    id: "tetris",
    label: "Classic Tetris",
    stats: [
      { label: "Mode", value: "Lines" },
      { label: "Board", value: "10x20" },
      { label: "Pieces", value: "7" },
    ],
  },
];

export function GameLauncher() {
  const [selectedGameId, setSelectedGameId] = useState<GameId | null>(null);

  const selectedGame = GAME_CARDS.find((game) => game.id === selectedGameId) ?? null;

  const returnToMenu = useCallback(() => {
    setSelectedGameId(null);
  }, []);

  if (selectedGame !== null) {
    const SelectedGame = selectedGame.component;

    return <SelectedGame onBackToMenu={returnToMenu} />;
  }

  return (
    <main
      className="min-h-svh bg-[var(--snake-page)] px-4 py-6 text-[var(--snake-ink)] sm:px-6 lg:py-8"
      data-testid="game-menu"
    >
      <section className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-6xl flex-col justify-center gap-6">
        <header className="flex max-w-2xl flex-col gap-3">
          <div
            className="flex size-11 items-center justify-center rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] text-[var(--snake-muted)] shadow-sm"
            aria-hidden="true"
          >
            <Gamepad2Icon className="size-5" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-normal text-[var(--snake-muted)]">
              Game Library
            </p>
            <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
              Choose a game
            </h1>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
          {GAME_CARDS.map((game) => (
            <button
              aria-label={`Play ${game.label}`}
              className="group flex min-h-72 w-full flex-col overflow-hidden rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--snake-head)_45%,var(--snake-border))] hover:shadow-[0_22px_70px_color-mix(in_oklch,var(--snake-board)_14%,transparent)] focus-visible:border-[var(--snake-head)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)] active:translate-y-0"
              data-testid={`game-card-${game.id}`}
              key={game.id}
              onClick={() => setSelectedGameId(game.id)}
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
                  src={game.artwork.src}
                  unoptimized={game.artwork.unoptimized}
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
                    src={game.artwork.src}
                    unoptimized={game.artwork.unoptimized}
                    width={game.artwork.width}
                  />
                </span>
              </span>

              <span className="flex flex-1 flex-col gap-4 p-4">
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

                <span className="mt-auto grid grid-cols-3 gap-2">
                  {game.stats.map((stat) => (
                    <span
                      className="rounded-md border border-[var(--snake-border)] p-2"
                      key={stat.label}
                    >
                      <span className="block text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--snake-muted)]">
                        {stat.label}
                      </span>
                      <span className="block truncate text-sm font-semibold">
                        {stat.value}
                      </span>
                    </span>
                  ))}
                </span>
              </span>
            </button>
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
