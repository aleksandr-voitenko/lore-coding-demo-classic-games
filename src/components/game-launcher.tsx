"use client";

import { Gamepad2Icon, PlayIcon, TrophyIcon } from "lucide-react";
import Image from "next/image";
import { type ComponentType, useCallback, useState } from "react";

import { BreakoutGame } from "@/components/breakout-game";
import { MinesweeperGame } from "@/components/minesweeper-game";
import { PongGame } from "@/components/pong-game";
import { SimonGame } from "@/components/simon-game";
import { SnakeGame } from "@/components/snake-game";
import { SpaceInvadersGame } from "@/components/space-invaders-game";
import { TetrisGame } from "@/components/tetris-game";
import { TwentyFortyEightGame } from "@/components/twenty-forty-eight-game";
import {
  BOARD_SIZE_OPTIONS,
  DEFAULT_BOARD_SIZE,
  MAX_BOARD_SIZE,
  MIN_BOARD_SIZE,
  normalizeBoardSize,
} from "@/lib/snake-game-engine";

type GameId =
  | "snake"
  | "tetris"
  | "breakout"
  | "minesweeper"
  | "space-invaders"
  | "twenty-forty-eight"
  | "pong"
  | "simon";

type PlayableGameProps = {
  initialBoardSize?: number;
  onBackToMenu: () => void;
};

type GameCardStat = {
  kind?: "snake-board-size";
  label: string;
  value: string;
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
  stats: GameCardStat[];
};

const GAME_CARDS: GameCard[] = [
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--snake-head),var(--snake-bonus-food),var(--snake-speed-food),var(--snake-slow-food),var(--snake-shrink-food))]",
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
      { kind: "snake-board-size", label: "Field size", value: "11-25" },
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
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--breakout-red),var(--breakout-yellow),var(--breakout-green),var(--breakout-blue))]",
    artwork: {
      height: 250,
      loading: "eager",
      src: "/images/breakout-game-card.svg",
      unoptimized: true,
      width: 250,
    },
    component: BreakoutGame,
    description: "A paddle-and-ball brick breaker with lives, scoring, and wall clears.",
    id: "breakout",
    label: "Classic Breakout",
    stats: [
      { label: "Mode", value: "Bricks" },
      { label: "Board", value: "420x560" },
      { label: "Lives", value: "3" },
    ],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--minesweeper-flag),var(--minesweeper-one),var(--minesweeper-two),var(--minesweeper-three))]",
    artwork: {
      height: 250,
      loading: "eager",
      src: "/images/minesweeper-game-card.svg",
      unoptimized: true,
      width: 250,
    },
    component: MinesweeperGame,
    description: "A classic minefield puzzle with safe first clicks, flags, and flood reveals.",
    id: "minesweeper",
    label: "Classic Minesweeper",
    stats: [
      { label: "Mode", value: "Flags" },
      { label: "Board", value: "9x9" },
      { label: "Mines", value: "10" },
    ],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--invaders-lime),var(--invaders-cyan),var(--invaders-magenta),var(--invaders-yellow))]",
    artwork: {
      height: 250,
      loading: "eager",
      src: "/images/space-invaders-game-card.svg",
      unoptimized: true,
      width: 250,
    },
    component: SpaceInvadersGame,
    description: "A cannon defense arcade game with marching invaders, shots, and scoring.",
    id: "space-invaders",
    label: "Classic Space Invaders",
    stats: [
      { label: "Mode", value: "Defense" },
      { label: "Board", value: "420x560" },
      { label: "Aliens", value: "55" },
    ],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--twenty-tile-8),var(--twenty-tile-128),var(--twenty-tile-2048))]",
    artwork: {
      height: 250,
      loading: "eager",
      src: "/images/twenty-forty-eight-game-card.svg",
      unoptimized: true,
      width: 250,
    },
    component: TwentyFortyEightGame,
    description: "A sliding tile puzzle with merges, score chasing, and a 2048 goal tile.",
    id: "twenty-forty-eight",
    label: "Classic 2048",
    stats: [
      { label: "Mode", value: "Merge" },
      { label: "Board", value: "4x4" },
      { label: "Goal", value: "2048" },
    ],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--pong-blue),var(--pong-ball),var(--pong-pink))]",
    artwork: {
      height: 250,
      loading: "eager",
      src: "/images/pong-game-card.svg",
      unoptimized: true,
      width: 250,
    },
    component: PongGame,
    description: "A paddle duel against a CPU opponent with rebounds, rallies, and scoring.",
    id: "pong",
    label: "Classic Pong",
    stats: [
      { label: "Mode", value: "Duel" },
      { label: "Board", value: "420x560" },
      { label: "Target", value: "5" },
    ],
  },
  {
    accentClassName: "bg-[linear-gradient(90deg,#25a75a,#d73548,#f0bd38,#1d7ed0)]",
    artwork: {
      height: 250,
      loading: "eager",
      src: "/images/simon-game-card.svg",
      unoptimized: true,
      width: 250,
    },
    component: SimonGame,
    description: "A memory pattern game with four pads, growing sequences, and strict misses.",
    id: "simon",
    label: "Classic Simon",
    stats: [
      { label: "Mode", value: "Memory" },
      { label: "Pads", value: "4" },
      { label: "Target", value: "12" },
    ],
  },
];

export function GameLauncher() {
  const [selectedGameId, setSelectedGameId] = useState<GameId | null>(null);
  const [snakeBoardSize, setSnakeBoardSize] = useState(DEFAULT_BOARD_SIZE);

  const selectedGame = GAME_CARDS.find((game) => game.id === selectedGameId) ?? null;

  const returnToMenu = useCallback(() => {
    setSelectedGameId(null);
  }, []);

  if (selectedGame !== null) {
    const SelectedGame = selectedGame.component;

    return (
      <SelectedGame
        initialBoardSize={selectedGame.id === "snake" ? snakeBoardSize : undefined}
        onBackToMenu={returnToMenu}
      />
    );
  }

  return (
    <main
      className="min-h-svh bg-[var(--snake-page)] px-4 py-6 text-[var(--snake-ink)] sm:px-6 lg:py-8"
      data-testid="game-menu"
    >
      <section className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-6xl flex-col justify-center gap-6">
        <header className="flex max-w-2xl items-center gap-4">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] text-[var(--snake-muted)] shadow-sm"
            aria-hidden="true"
          >
            <Gamepad2Icon className="size-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-black sm:text-4xl">
            Game Library
          </h1>
        </header>

        <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
          {GAME_CARDS.map((game) => (
            <article
              className="group flex min-h-72 w-full flex-col overflow-hidden rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--snake-head)_45%,var(--snake-border))] hover:shadow-[0_22px_70px_color-mix(in_oklch,var(--snake-board)_14%,transparent)] focus-within:border-[var(--snake-head)] focus-within:ring-3 focus-within:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)]"
              key={game.id}
            >
              <button
                aria-label={`Play ${game.label}`}
                className="flex flex-1 flex-col text-left focus-visible:outline-none"
                data-testid={`game-card-${game.id}`}
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

              <div className="mt-auto grid grid-cols-3 gap-2 p-4">
                {game.stats.map((stat) => (
                  <div
                    className="rounded-md border border-[var(--snake-border)] p-2"
                    key={stat.label}
                  >
                    {stat.kind === "snake-board-size" ? (
                      <>
                        <label
                          className="block text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--snake-muted)]"
                          htmlFor="snake-board-size"
                        >
                          {stat.label}
                        </label>
                        <select
                          aria-label={`Field size. Selectable from ${MIN_BOARD_SIZE} by ${MIN_BOARD_SIZE} to ${MAX_BOARD_SIZE} by ${MAX_BOARD_SIZE}.`}
                          className="mt-1 h-8 w-full min-w-0 rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] px-2 text-sm font-semibold text-[var(--snake-ink)] outline-none transition focus-visible:border-[var(--snake-head)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)]"
                          data-testid="snake-board-size"
                          id="snake-board-size"
                          onChange={(event) =>
                            setSnakeBoardSize(normalizeBoardSize(Number(event.target.value)))
                          }
                          value={snakeBoardSize}
                        >
                          {BOARD_SIZE_OPTIONS.map((boardSize) => (
                            <option
                              key={boardSize}
                              value={boardSize}
                            >
                              {boardSize} x {boardSize}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <>
                        <span className="block text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--snake-muted)]">
                          {stat.label}
                        </span>
                        <span className="block truncate text-sm font-semibold">
                          {stat.value}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </article>
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
